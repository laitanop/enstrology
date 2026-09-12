import { resolveResolverAddress } from '@/lib/contracts';
import { namehash, parseAbiItem } from 'viem';
import {
  getPurchasedReadings,
  getPurchaseTransactionHash,
  getReadingRecord,
  publicClient,
  resolveOracleSubregistry,
} from '@/lib/oracle';

const RESOLVER_ADDRESS = resolveResolverAddress(
  process.env.RESOLVER_ADDRESS,
  process.env.NEXT_PUBLIC_RESOLVER_ADDRESS,
);
const ORACLE_ENS_NAME = (process.env.ORACLE_ENS_NAME || 'oracle.enstrology.eth').toLowerCase();
const FEED_CACHE_MS = 180_000;
let feedCache: { at: number; cards: FeedCard[] } | null = null;

export function invalidateFeedCache(): void {
  feedCache = null;
}
const FEED_LOOKBACK_BLOCKS = BigInt(process.env.FEED_LOOKBACK_BLOCKS || '12000');
const FEED_MAX_ITEMS = Number(process.env.FEED_MAX_ITEMS || '24');
const FEED_LOG_CHUNK = BigInt(process.env.FEED_LOG_CHUNK || '2000');

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
  expiresAt: string;
  paymentTxHash: `0x${string}` | null;
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
  const earliestBlock =
    latestBlock > FEED_LOOKBACK_BLOCKS ? latestBlock - FEED_LOOKBACK_BLOCKS : BigInt(0);
  const chunkSize = FEED_LOG_CHUNK < BigInt(1) ? BigInt(1) : FEED_LOG_CHUNK;
  const ranges: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
  for (let toBlock = latestBlock; toBlock > earliestBlock; toBlock -= chunkSize) {
    const fromBlock =
      toBlock > earliestBlock + chunkSize ? toBlock - chunkSize + BigInt(1) : earliestBlock;
    ranges.push({ fromBlock, toBlock });
  }

  for (let i = 0; i < ranges.length && mapped.size < wanted.size; i += 4) {
    const batch = ranges.slice(i, i + 4);
    const groups = await Promise.all(
      batch.map(async ({ fromBlock, toBlock }) => {
        try {
          return await publicClient.getLogs({
            address: subregistry,
            event: LABEL_REGISTERED_EVENT,
            fromBlock,
            toBlock,
          });
        } catch {
          return [];
        }
      }),
    );

    for (const logs of groups) {
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
    }
  }

  return mapped;
}

export async function listPublishedReadings(): Promise<FeedCard[]> {
  if (feedCache && Date.now() - feedCache.at < FEED_CACHE_MS) {
    return feedCache.cards;
  }

  const latestBlock = await publicClient.getBlockNumber();
  const fromBlock = latestBlock > FEED_LOOKBACK_BLOCKS ? latestBlock - FEED_LOOKBACK_BLOCKS : BigInt(0);
  const purchases = await getPurchasedReadings(fromBlock, latestBlock);
  const newestFirst = [...purchases].sort((a, b) =>
    a.blockNumber < b.blockNumber ? 1 : a.blockNumber > b.blockNumber ? -1 : 0
  );

  const records = await Promise.all(
    newestFirst.slice(0, 40).map(async (purchase) => {
      const record = await getReadingRecord(purchase.readingNamehash);
      return { purchase, record };
    }),
  );

  const published: Array<{
    readingNamehash: `0x${string}`;
    buyer: `0x${string}`;
    purchasedAt: bigint;
    paymentTxHash: `0x${string}` | null;
  }> = [];

  for (const { purchase, record } of records) {
    if (!record.published) {
      continue;
    }
    published.push({
      readingNamehash: purchase.readingNamehash,
      buyer: record.buyer,
      purchasedAt: record.purchasedAt,
      paymentTxHash: purchase.transactionHash,
    });
    if (published.length >= FEED_MAX_ITEMS) {
      break;
    }
  }

  const names = await mapNamehashToReadingName(published.map((item) => item.readingNamehash));
  const resolved = await Promise.all(
    published.map((item) =>
      toFeedCard(item, names.get(item.readingNamehash.toLowerCase()) || ''),
    ),
  );
  const cards = resolved.filter((card): card is FeedCard => Boolean(card));

  feedCache = { at: Date.now(), cards };
  return cards;
}

export async function getPublishedReading(
  readingNamehash: `0x${string}`,
  readingEnsNameHint?: string,
  paymentTxHint?: string
): Promise<FeedCard | null> {
  const hintedPayment =
    paymentTxHint && /^0x[a-fA-F0-9]{64}$/.test(paymentTxHint)
      ? (paymentTxHint as `0x${string}`)
      : null;

  const cached = feedCache?.cards.find(
    (card) => card.readingNamehash.toLowerCase() === readingNamehash.toLowerCase()
  );
  if (cached) {
    return {
      ...cached,
      paymentTxHash: hintedPayment || cached.paymentTxHash,
    };
  }

  const record = await getReadingRecord(readingNamehash);
  if (!record.buyer || record.buyer.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    return null;
  }
  if (!record.published) {
    return null;
  }

  const hintedName = (readingEnsNameHint || '').trim().toLowerCase();
  const readingEnsName =
    hintedName && namehash(hintedName).toLowerCase() === readingNamehash.toLowerCase()
      ? hintedName
      : '';

  const paymentTxHash =
    hintedPayment || (await getPurchaseTransactionHash(readingNamehash));

  return toFeedCard(
    {
      readingNamehash,
      buyer: record.buyer,
      purchasedAt: record.purchasedAt,
      paymentTxHash,
    },
    readingEnsName
  );
}

async function toFeedCard(
  item: {
    readingNamehash: `0x${string}`;
    buyer: `0x${string}`;
    purchasedAt: bigint;
    paymentTxHash: `0x${string}` | null;
  },
  readingEnsName: string
): Promise<FeedCard | null> {
  const [reading, sign, title, luckyColor, luckyNumber] = await Promise.all([
    readText(item.readingNamehash, 'horoscope.reading'),
    readText(item.readingNamehash, 'horoscope.sign'),
    readText(item.readingNamehash, 'horoscope.title'),
    readText(item.readingNamehash, 'horoscope.luckyColor'),
    readText(item.readingNamehash, 'horoscope.luckyNumber'),
  ]);
  if (!reading) {
    return null;
  }

  const label = readingEnsName.split('.')[0] || '';
  const [sourceLabel, compactDate] = label.split('-');
  const birthdate =
    compactDate && compactDate.length === 8
      ? `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}`
      : '';
  const purchasedMs = Number(item.purchasedAt) * 1000;
  const expiresMs = purchasedMs + 30 * 24 * 60 * 60 * 1000;

  return {
    readingNamehash: item.readingNamehash,
    readingEnsName,
    sourceEnsName: sourceLabel ? `${sourceLabel}.eth` : 'Unknown source',
    birthdate,
    buyer: item.buyer,
    purchasedAt: new Date(purchasedMs).toISOString(),
    expiresAt: new Date(expiresMs).toISOString(),
    paymentTxHash: item.paymentTxHash,
    sign,
    title,
    reading,
    luckyColor,
    luckyNumber,
  };
}