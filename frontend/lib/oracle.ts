import { createPublicClient, createWalletClient, http, namehash, parseAbiItem } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { OpenRouter } from '@openrouter/sdk';
import { z } from 'zod';

const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const ENSTROLOGY_PAY_ADDRESS =
  process.env.ENSTROLOGYP_PAY_ADDRESS || process.env.NEXT_PUBLIC_ENSTROLOGYP_PAY_ADDRESS;
const RESOLVER_ADDRESS = process.env.RESOLVER_ADDRESS || process.env.NEXT_PUBLIC_RESOLVER_ADDRESS;
const ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY;
const APP_PRIVATE_KEY = process.env.APP_PRIVATE_KEY;
const DEFAULT_ORACLE_MODEL = process.env.ORACLE_MODEL || 'anthropic/claude-3.5-sonnet';
const MAX_LOG_BLOCK_RANGE = BigInt(process.env.ORACLE_MAX_LOG_BLOCK_RANGE || '49000');
const ALL_ROLES_MASK = BigInt(
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
);

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

if (!ORACLE_PRIVATE_KEY) {
  throw new Error('Missing ORACLE_PRIVATE_KEY');
}

const oracleAccount = privateKeyToAccount(ORACLE_PRIVATE_KEY as `0x${string}`);
export const ORACLE_ADDRESS = oracleAccount.address;

// Clients
export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(SEPOLIA_RPC),
});

export const oracleWalletClient = createWalletClient({
  chain: sepolia,
  transport: http(SEPOLIA_RPC),
  account: oracleAccount,
});

// Contract ABIs
const RESOLVER_ABI = [
  {
    name: 'setText',
    type: 'function',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
      { name: 'value', type: 'string' },
    ],
    outputs: [],
  },
] as const;

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

const ENSTROLOGY_PAY_ABI = [
  {
    name: 'readings',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'readingNamehash', type: 'bytes32' }],
    outputs: [
      { name: 'buyer', type: 'address' },
      { name: 'sourceNamehash', type: 'bytes32' },
      { name: 'purchasedAt', type: 'uint256' },
      { name: 'published', type: 'bool' },
    ],
  },
] as const;

const RESOLVER_ROLES_ABI = [
  {
    name: 'revokeRoles',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'account', type: 'address' },
      { name: 'roles', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

const READING_PURCHASED_EVENT = parseAbiItem(
  'event ReadingPurchased(address indexed buyer, bytes32 indexed sourceNamehash, bytes32 indexed readingNamehash, uint256 amount, uint256 timestamp)'
);

const HOROSCOPE_SCHEMA = z
  .object({
    sign: z.string().trim().min(1).max(32),
    title: z.string().trim().min(1).max(120),
    reading: z.string().trim().min(1).max(600),
    luckyColor: z.string().trim().min(1).max(40),
    luckyNumber: z.string().trim().min(1).max(16),
  })
  .strict();

export type OnChainReading = {
  buyer: `0x${string}`;
  sourceNamehash: `0x${string}`;
  purchasedAt: bigint;
  published: boolean;
};

export type PurchasedReadingEvent = {
  buyer: `0x${string}`;
  sourceNamehash: `0x${string}`;
  readingNamehash: `0x${string}`;
  amount: bigint;
  timestamp: bigint;
  blockNumber: bigint;
};

function getAppWalletClient() {
  if (!APP_PRIVATE_KEY) {
    throw new Error('Missing APP_PRIVATE_KEY');
  }

  return createWalletClient({
    chain: sepolia,
    transport: http(SEPOLIA_RPC),
    account: privateKeyToAccount(APP_PRIVATE_KEY as `0x${string}`),
  });
}

export function computeSourceNamehash(sourceEnsName: string): `0x${string}` {
  const normalized = sourceEnsName.trim().toLowerCase();
  if (!normalized) {
    throw new Error('sourceEnsName cannot be empty');
  }
  return namehash(normalized);
}

async function assertContractDeployed(address: `0x${string}`, label: string): Promise<void> {
  const bytecode = await publicClient.getCode({ address });
  if (!bytecode || bytecode === '0x') {
    throw new Error(`${label} is not deployed at ${address} on Sepolia`);
  }
}

export async function getReadingRecord(readingNamehash: `0x${string}`): Promise<OnChainReading> {
  if (!ENSTROLOGY_PAY_ADDRESS) {
    throw new Error('Missing ENSTROLOGYP_PAY_ADDRESS');
  }
  await assertContractDeployed(
    ENSTROLOGY_PAY_ADDRESS as `0x${string}`,
    'ENStrologyPay contract'
  );

  const reading = await publicClient.readContract({
    address: ENSTROLOGY_PAY_ADDRESS as `0x${string}`,
    abi: ENSTROLOGY_PAY_ABI,
    functionName: 'readings',
    args: [readingNamehash],
  });

  const [buyer, sourceNamehash, purchasedAt, published] = reading;
  return { buyer, sourceNamehash, purchasedAt, published };
}

export async function hasHoroscopeRecord(readingNamehash: `0x${string}`): Promise<boolean> {
  if (!RESOLVER_ADDRESS) {
    throw new Error('Missing RESOLVER_ADDRESS');
  }

  try {
    const existing = await publicClient.readContract({
      address: RESOLVER_ADDRESS as `0x${string}`,
      abi: RESOLVER_READ_ABI,
      functionName: 'text',
      args: [readingNamehash, 'horoscope.reading'],
    });
    return typeof existing === 'string' && existing.trim().length > 0;
  } catch {
    // Some resolver implementations may revert for missing keys.
    return false;
  }
}

export async function getPurchasedReadings(
  fromBlock: bigint,
  toBlock: bigint
): Promise<PurchasedReadingEvent[]> {
  if (!ENSTROLOGY_PAY_ADDRESS) {
    throw new Error('Missing ENSTROLOGYP_PAY_ADDRESS');
  }
  await assertContractDeployed(
    ENSTROLOGY_PAY_ADDRESS as `0x${string}`,
    'ENStrologyPay contract'
  );

  if (fromBlock > toBlock) {
    throw new Error('fromBlock must be <= toBlock');
  }
  if (MAX_LOG_BLOCK_RANGE < BigInt(1)) {
    throw new Error('ORACLE_MAX_LOG_BLOCK_RANGE must be >= 1');
  }

  const logs = [];
  const one = BigInt(1);
  let chunkStart = fromBlock;

  while (chunkStart <= toBlock) {
    const chunkEndCandidate = chunkStart + MAX_LOG_BLOCK_RANGE - one;
    const chunkEnd = chunkEndCandidate < toBlock ? chunkEndCandidate : toBlock;

    const chunkLogs = await publicClient.getLogs({
      address: ENSTROLOGY_PAY_ADDRESS as `0x${string}`,
      event: READING_PURCHASED_EVENT,
      fromBlock: chunkStart,
      toBlock: chunkEnd,
    });
    logs.push(...chunkLogs);

    chunkStart = chunkEnd + one;
  }

  return logs
    .map((log) => {
      const args = log.args;
      if (
        !args.buyer ||
        !args.sourceNamehash ||
        !args.readingNamehash ||
        args.amount === undefined ||
        args.timestamp === undefined ||
        log.blockNumber === null
      ) {
        return null;
      }

      return {
        buyer: args.buyer,
        sourceNamehash: args.sourceNamehash,
        readingNamehash: args.readingNamehash,
        amount: args.amount,
        timestamp: args.timestamp,
        blockNumber: log.blockNumber,
      };
    })
    .filter((event): event is PurchasedReadingEvent => event !== null);
}

// Helper: Write text record to resolver
export async function writeTextRecord(
  namehash: `0x${string}`,
  key: string,
  value: string
): Promise<`0x${string}`> {
  if (!RESOLVER_ADDRESS) {
    throw new Error('Missing RESOLVER_ADDRESS');
  }

  const hash = await oracleWalletClient.writeContract({
    address: RESOLVER_ADDRESS as `0x${string}`,
    abi: RESOLVER_ABI,
    functionName: 'setText',
    args: [namehash, key, value],
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function revokeOracleTextRoles(
  node: `0x${string}`,
  roleMask: bigint = ALL_ROLES_MASK
): Promise<`0x${string}`> {
  if (!RESOLVER_ADDRESS) {
    throw new Error('Missing RESOLVER_ADDRESS');
  }

  const appWalletClient = getAppWalletClient();
  const hash = await appWalletClient.writeContract({
    address: RESOLVER_ADDRESS as `0x${string}`,
    abi: RESOLVER_ROLES_ABI,
    functionName: 'revokeRoles',
    args: [node, ORACLE_ADDRESS, roleMask],
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

// Horoscope type
export type Horoscope = {
  sign: string;
  title: string;
  reading: string;
  luckyColor: string;
  luckyNumber: string;
};

function extractAssistantText(
  content: string | Array<{ type?: string; text?: string }> | null | undefined
): string {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return '';
  }

  const joined = content
    .map((item) => (item.type === 'text' && typeof item.text === 'string' ? item.text : ''))
    .join('\n')
    .trim();
  return joined;
}

function parseHoroscopeJson(rawText: string): Horoscope {
  try {
    return HOROSCOPE_SCHEMA.parse(JSON.parse(rawText));
  } catch {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse horoscope JSON');
    }
    return HOROSCOPE_SCHEMA.parse(JSON.parse(jsonMatch[0]));
  }
}

// Generate horoscope using Claude AI via OpenRouter
export async function generateHoroscope(
  sourceEnsName: string,
  birthdateISO: string
): Promise<Horoscope> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENROUTER_API_KEY');
  }

  const client = new OpenRouter({ apiKey });

  const response = await client.chat.send({
    chatRequest: {
      stream: false,
      model: DEFAULT_ORACLE_MODEL,
      temperature: 0.8,
      maxCompletionTokens: 350,
      responseFormat: {
        type: 'json_schema',
        jsonSchema: {
          name: 'enstrology_horoscope',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['sign', 'title', 'reading', 'luckyColor', 'luckyNumber'],
            properties: {
              sign: { type: 'string', minLength: 1, maxLength: 32 },
              title: { type: 'string', minLength: 1, maxLength: 120 },
              reading: { type: 'string', minLength: 1, maxLength: 600 },
              luckyColor: { type: 'string', minLength: 1, maxLength: 40 },
              luckyNumber: { type: 'string', minLength: 1, maxLength: 16 },
            },
          },
        },
      },
      messages: [
        {
          role: 'system',
          content:
            'You are ENStrology Oracle. Return only valid JSON matching the requested schema. Keep content fun, positive, and entertainment-focused.',
        },
        {
          role: 'user',
          content: `Generate a fun, entertaining horoscope for ENS name "${sourceEnsName}" using on-chain birthdate ${birthdateISO}.`,
        },
      ],
    },
  });

  if (!('choices' in response)) {
    throw new Error('Unexpected streaming response');
  }

  const content = response.choices?.[0]?.message?.content;
  const rawText = extractAssistantText(
    content as string | Array<{ type?: string; text?: string }> | null | undefined
  );
  if (!rawText) {
    throw new Error('No response from Claude');
  }

  return parseHoroscopeJson(rawText);
}

// Main: Write horoscope to oracle.enstrology.eth
export async function publishHoroscope(
  readingNamehash: `0x${string}`,
  horoscope: {
    sign: string;
    title: string;
    reading: string;
    luckyColor: string;
    luckyNumber: string;
  }
): Promise<{ [key: string]: `0x${string}` }> {
  const hashes: { [key: string]: `0x${string}` } = {};

  hashes.sign = await writeTextRecord(readingNamehash, 'horoscope.sign', horoscope.sign);
  hashes.title = await writeTextRecord(readingNamehash, 'horoscope.title', horoscope.title);
  hashes.reading = await writeTextRecord(readingNamehash, 'horoscope.reading', horoscope.reading);
  hashes.luckyColor = await writeTextRecord(
    readingNamehash,
    'horoscope.luckyColor',
    horoscope.luckyColor
  );
  hashes.luckyNumber = await writeTextRecord(
    readingNamehash,
    'horoscope.luckyNumber',
    horoscope.luckyNumber
  );

  return hashes;
}
