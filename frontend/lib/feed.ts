import { namehash, parseAbiItem } from 'viem';
import {
  getPurchasedReadings,
  getReadingRecord,
  publicClient,
  resolveOracleSubregistry,
} from '@/lib/oracle';

const RESOLVER_ADDRESS = (process.env.RESOLVER_ADDRESS ||
  process.env.NEXT_PUBLIC_RESOLVER_ADDRESS) as `0x${string}` | undefined;
const ORACLE_ENS_NAME = (process.env.ORACLE_ENS_NAME || 'oracle.enstrology.eth').toLowerCase();
const FEED_LOOKBACK_BLOCKS = BigInt(process.env.FEED_LOOKBACK_BLOCKS || '200000');
const FEED_MAX_ITEMS = Number(process.env.FEED_MAX_ITEMS || '24');

const LABEL_REGISTERED_EVENT = parseAbiItem(
  'event LabelRegistered(uint256 indexed tokenId, bytes32 indexed labelHash, string label, address owner, uint64 expiry, address indexed sender)'
);

const RESOLVER_READ_ABI = [
  {
    name: 'text',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
    ],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

export type FeedCard = {
  readingNamehash: `0x${string}`;
  readingEnsName: string;
  sourceEnsName: string;
  birthdate: string;
  buyer: `0x${string}`;
  purchasedAt: string;
  sign: string;
  title: string;
  reading: string;
  luckyColor: string;
  luckyNumber: string;
};

async function readText(node: `0x${string}`, key: string): Promise<string> {
  if (!RESOLVER_ADDRESS) {
    return '';
  }
  try {
    const value = await publicClient.readContract({
      address: RESOLVER_ADDRESS,
      abi: RESOLVER_READ_ABI,
      functionName: 'text',
      args: [node, key],
    });
    return typeof value === 'string' ? value.trim() : '';
  } catch {
    return '';
  }
}

async function mapNamehashToReadingName(
  readingNamehashes: `0x${string}`[]
): Promise<Map<string, string>> {
  const wanted = new Set(readingNamehashes.map((value) => value.toLowerCase()));
  const mapped = new Map<string, string>();
  if (!wanted.size) {
    return mapped;
  }

  const subregistry = await resolveOracleSubregistry();
  const latestBlock = await publicClient.getBlockNumber();
  const fromBlock = latestBlock > FEED_LOOKBACK_BLOCKS ? latestBlock - FEED_LOOKBACK_BLOCKS : BigInt(0);
  const logs = [];
  const chunkSize = BigInt(3000);
  for (let start = fromBlock; start <= latestBlock; start += chunkSize) {
    const endCandidate = start + chunkSize - BigInt(1);
    const end = endCandidate < latestBlock ? endCandidate : latestBlock;
    try {
      const chunk = await publicClient.getLogs({
        address: subregistry,
        event: LABEL_REGISTERED_EVENT,
        fromBlock: start,
        toBlock: end,
      });
      logs.push(...chunk);
    } catch {
      // Skip a chunk that exceeds the RPC range limit.
    }
  }

  for (const log of logs) {
    const label = log.args.label?.toLowerCase();
    if (!label) {
      continue;
    }
    const readingEnsName = `${label}.${ORACLE_ENS_NAME}`;
    const node = namehash(readingEnsName).toLowerCase();
    if (wanted.has(node)) {
      mapped.set(node, readingEnsName);
    }
  }

  return mapped;
}

export async function listPublishedReadings(): Promise<FeedCard[]> {
  const latestBlock = await publicClient.getBlockNumber();
  const fromBlock = latestBlock > FEED_LOOKBACK_BLOCKS ? latestBlock - FEED_LOOKBACK_BLOCKS : BigInt(0);
  const purchases = await getPurchasedReadings(fromBlock, latestBlock);
  const newestFirst = [...purchases].sort((a, b) =>
    a.blockNumber < b.blockNumber ? 1 : a.blockNumber > b.blockNumber ? -1 : 0
  );

  const published: Array<{
    readingNamehash: `0x${string}`;
    buyer: `0x${string}`;
    purchasedAt: bigint;
  }> = [];

  for (const purchase of newestFirst) {
    const record = await getReadingRecord(purchase.readingNamehash);
    if (!record.published) {
      continue;
    }
    published.push({
      readingNamehash: purchase.readingNamehash,
      buyer: record.buyer,
      purchasedAt: record.purchasedAt,
    });
    if (published.length >= FEED_MAX_ITEMS) {
      break;
    }
  }

  const names = await mapNamehashToReadingName(published.map((item) => item.readingNamehash));
  const cards: FeedCard[] = [];

  for (const item of published) {
    const reading = await readText(item.readingNamehash, 'horoscope.reading');
    if (!reading) {
      continue;
    }

    const readingEnsName = names.get(item.readingNamehash.toLowerCase()) || '';
    const label = readingEnsName.split('.')[0] || '';
    const [sourceLabel, compactDate] = label.split('-');
    const birthdate =
      compactDate && compactDate.length === 8
        ? `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}`
        : '';

    cards.push({
      readingNamehash: item.readingNamehash,
      readingEnsName,
      sourceEnsName: sourceLabel ? `${sourceLabel}.eth` : 'Unknown source',
      birthdate,
      buyer: item.buyer,
      purchasedAt: new Date(Number(item.purchasedAt) * 1000).toISOString(),
      sign: await readText(item.readingNamehash, 'horoscope.sign'),
      title: await readText(item.readingNamehash, 'horoscope.title'),
      reading,
      luckyColor: await readText(item.readingNamehash, 'horoscope.luckyColor'),
      luckyNumber: await readText(item.readingNamehash, 'horoscope.luckyNumber'),
    });
  }

  return cards;
}