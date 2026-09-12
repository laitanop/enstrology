import { writePurchasedReading } from '@/lib/oracle';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';
export const maxDuration = 60;

const READING_NAMEHASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
const ENS_NAME_REGEX = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;

type RateLimitEntry = {
  count: number;
  windowStart: number;
};

const requestCounts = new Map<string, RateLimitEntry>();

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

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

function isRateLimited(clientIp: string): boolean {
  const now = Date.now();

  if (requestCounts.size > 1000) {
    for (const [ip, entry] of requestCounts.entries()) {
      if (now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
        requestCounts.delete(ip);
      }
    }
  }

  const current = requestCounts.get(clientIp);

  if (!current || now - current.windowStart >= RATE_LIMIT_WINDOW_MS) {
    requestCounts.set(clientIp, { count: 1, windowStart: now });
    return false;
  }

  current.count += 1;
  requestCounts.set(clientIp, current);
  return current.count > MAX_REQUESTS_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientIp = getClientIp(request);
    if (isRateLimited(clientIp)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { readingNamehash, sourceEnsName, birthdate } = (body ?? {}) as {
      readingNamehash?: unknown;
      sourceEnsName?: unknown;
      birthdate?: unknown;
    };

    if (
      typeof readingNamehash !== 'string' ||
      typeof sourceEnsName !== 'string' ||
      typeof birthdate !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Missing required fields: readingNamehash, sourceEnsName, birthdate' },
        { status: 400 }
      );
    }

    if (!READING_NAMEHASH_REGEX.test(readingNamehash)) {
      return NextResponse.json({ error: 'Invalid readingNamehash format' }, { status: 400 });
    }

    const normalizedEnsName = sourceEnsName.trim().toLowerCase();
    if (!ENS_NAME_REGEX.test(normalizedEnsName)) {
      return NextResponse.json({ error: 'Invalid sourceEnsName format' }, { status: 400 });
    }

    if (Number.isNaN(Date.parse(birthdate))) {
      return NextResponse.json({ error: 'Invalid birthdate format' }, { status: 400 });
    }

    const result = await writePurchasedReading({
      readingNamehash: readingNamehash as `0x${string}`,
      sourceEnsName: normalizedEnsName,
      birthdate,
    });

    return NextResponse.json({
      success: true,
      readingEnsName: result.readingEnsName,
      horoscope: result.horoscope,
      transactions: result.transactions,
    });
  } catch (error) {
    console.error('Error:', error);
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : 'Oracle write failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
