import {
  computeSourceNamehash,
  generateHoroscope,
  getPurchasedReadings,
  hasHoroscopeRecord,
  publishHoroscope,
  publicClient,
} from '@/lib/oracle';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';

const DEFAULT_LOOKBACK_BLOCKS = BigInt(process.env.ORACLE_LOOKBACK_BLOCKS || '1500');
const DEFAULT_MAX_EVENTS = 20;
const MAX_EVENTS_LIMIT = 100;
const NAMEHASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
const ENS_NAME_REGEX = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/;

type HoroscopeInput = {
  sourceEnsName: string;
  birthdateISO: string;
};

type RequestBody = {
  metadataByReadingNamehash?: Record<string, HoroscopeInput>;
  metadataBySourceNamehash?: Record<string, HoroscopeInput>;
};

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function isAuthorized(request: NextRequest): boolean {
  const apiKey = process.env.ORACLE_WRITE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ORACLE_WRITE_API_KEY');
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice('Bearer '.length);
  return safeEqual(token, apiKey);
}

function parseOptionalBlock(rawValue: string | null): bigint | null {
  if (!rawValue) {
    return null;
  }
  if (!/^\d+$/.test(rawValue)) {
    throw new Error('Block values must be unsigned integers');
  }
  return BigInt(rawValue);
}

function parseMaxEvents(rawValue: string | null): number {
  if (!rawValue) {
    return DEFAULT_MAX_EVENTS;
  }
  if (!/^\d+$/.test(rawValue)) {
    throw new Error('maxEvents must be an unsigned integer');
  }

  const parsed = Number(rawValue);
  if (parsed < 1 || parsed > MAX_EVENTS_LIMIT) {
    throw new Error(`maxEvents must be between 1 and ${MAX_EVENTS_LIMIT}`);
  }
  return parsed;
}

function parseHoroscopeInput(rawValue: unknown, context: string): HoroscopeInput {
  if (typeof rawValue !== 'object' || rawValue === null) {
    throw new Error(`Invalid ${context} metadata`);
  }

  const maybeObject = rawValue as { sourceEnsName?: unknown; birthdateISO?: unknown };
  if (typeof maybeObject.sourceEnsName !== 'string' || typeof maybeObject.birthdateISO !== 'string') {
    throw new Error(`Invalid ${context} metadata fields`);
  }

  const sourceEnsName = maybeObject.sourceEnsName.trim().toLowerCase();
  if (!ENS_NAME_REGEX.test(sourceEnsName)) {
    throw new Error(`Invalid ${context} sourceEnsName`);
  }

  const birthdateISO = maybeObject.birthdateISO.trim();
  if (Number.isNaN(Date.parse(birthdateISO))) {
    throw new Error(`Invalid ${context} birthdateISO`);
  }

  return { sourceEnsName, birthdateISO };
}

function parseMetadataIndex(
  rawIndex: unknown,
  context: string
): Map<string, HoroscopeInput> {
  const index = new Map<string, HoroscopeInput>();
  if (rawIndex === undefined) {
    return index;
  }

  if (typeof rawIndex !== 'object' || rawIndex === null || Array.isArray(rawIndex)) {
    throw new Error(`Invalid ${context} map`);
  }

  for (const [rawKey, rawValue] of Object.entries(rawIndex)) {
    if (!NAMEHASH_REGEX.test(rawKey)) {
      throw new Error(`Invalid ${context} key: ${rawKey}`);
    }
    const parsedValue = parseHoroscopeInput(rawValue, context);
    index.set(rawKey.toLowerCase(), parsedValue);
  }

  return index;
}

async function parseRequestBody(request: NextRequest): Promise<RequestBody> {
  const rawBody = await request.text();
  if (!rawBody.trim()) {
    return {};
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    throw new Error('Invalid JSON body');
  }

  if (typeof parsedBody !== 'object' || parsedBody === null || Array.isArray(parsedBody)) {
    throw new Error('Invalid request body');
  }

  return parsedBody as RequestBody;
}

function isBadRequestMessage(message: string): boolean {
  return (
    message.startsWith('Invalid ') ||
    message.includes('must be') ||
    message.includes('between')
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const latestBlock = await publicClient.getBlockNumber();

    const fromBlockParam = parseOptionalBlock(searchParams.get('fromBlock'));
    const toBlockParam = parseOptionalBlock(searchParams.get('toBlock'));
    const maxEvents = parseMaxEvents(searchParams.get('maxEvents'));
    const dryRun = searchParams.get('dryRun') === 'true';
    const requestBody = await parseRequestBody(request);
    const metadataByReadingNamehash = parseMetadataIndex(
      requestBody.metadataByReadingNamehash,
      'metadataByReadingNamehash'
    );
    const metadataBySourceNamehash = parseMetadataIndex(
      requestBody.metadataBySourceNamehash,
      'metadataBySourceNamehash'
    );

    const fromBlock =
      fromBlockParam ??
      (latestBlock > DEFAULT_LOOKBACK_BLOCKS
        ? latestBlock - DEFAULT_LOOKBACK_BLOCKS
        : BigInt(0));
    const toBlock = toBlockParam ?? latestBlock;

    if (fromBlock > toBlock) {
      return NextResponse.json({ error: 'fromBlock must be <= toBlock' }, { status: 400 });
    }

    const purchases = await getPurchasedReadings(fromBlock, toBlock);
    const ordered = purchases.sort((a, b) =>
      a.blockNumber < b.blockNumber ? -1 : a.blockNumber > b.blockNumber ? 1 : 0
    );

    const processed: Array<{
      readingNamehash: `0x${string}`;
      sourceNamehash: `0x${string}`;
      blockNumber: string;
      status: 'processed' | 'skipped' | 'dry-run';
      reason?: string;
      transactions?: Record<string, `0x${string}`>;
    }> = [];

    for (const purchase of ordered.slice(0, maxEvents)) {
      const alreadyWritten = await hasHoroscopeRecord(purchase.readingNamehash);
      if (alreadyWritten) {
        processed.push({
          readingNamehash: purchase.readingNamehash,
          sourceNamehash: purchase.sourceNamehash,
          blockNumber: purchase.blockNumber.toString(),
          status: 'skipped',
          reason: 'horoscope already exists',
        });
        continue;
      }

      const metadata =
        metadataByReadingNamehash.get(purchase.readingNamehash.toLowerCase()) ||
        metadataBySourceNamehash.get(purchase.sourceNamehash.toLowerCase());

      if (!metadata) {
        processed.push({
          readingNamehash: purchase.readingNamehash,
          sourceNamehash: purchase.sourceNamehash,
          blockNumber: purchase.blockNumber.toString(),
          status: 'skipped',
          reason:
            'missing metadata (provide sourceEnsName and birthdateISO in metadataByReadingNamehash or metadataBySourceNamehash)',
        });
        continue;
      }

      const metadataNamehash = computeSourceNamehash(metadata.sourceEnsName);
      if (metadataNamehash.toLowerCase() !== purchase.sourceNamehash.toLowerCase()) {
        processed.push({
          readingNamehash: purchase.readingNamehash,
          sourceNamehash: purchase.sourceNamehash,
          blockNumber: purchase.blockNumber.toString(),
          status: 'skipped',
          reason: 'provided sourceEnsName does not match sourceNamehash from purchase event',
        });
        continue;
      }

      if (dryRun) {
        processed.push({
          readingNamehash: purchase.readingNamehash,
          sourceNamehash: purchase.sourceNamehash,
          blockNumber: purchase.blockNumber.toString(),
          status: 'dry-run',
          reason: 'metadata valid; would generate and publish',
        });
        continue;
      }

      const horoscope = await generateHoroscope(metadata.sourceEnsName, metadata.birthdateISO);
      const transactions = await publishHoroscope(purchase.readingNamehash, horoscope);

      processed.push({
        readingNamehash: purchase.readingNamehash,
        sourceNamehash: purchase.sourceNamehash,
        blockNumber: purchase.blockNumber.toString(),
        status: 'processed',
        transactions,
      });
    }

    return NextResponse.json({
      success: true,
      fromBlock: fromBlock.toString(),
      toBlock: toBlock.toString(),
      latestBlock: latestBlock.toString(),
      scannedPurchases: purchases.length,
      processedCount: processed.filter((item) => item.status === 'processed').length,
      skippedCount: processed.filter((item) => item.status === 'skipped').length,
      dryRunCount: processed.filter((item) => item.status === 'dry-run').length,
      processed,
    });
  } catch (error) {
    console.error('Error processing purchases:', error);
    const message = error instanceof Error ? error.message : '';
    if (isBadRequestMessage(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
