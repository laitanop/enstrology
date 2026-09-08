import { createPublicClient, createWalletClient, http, namehash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const ENSTROLOGY_PAY_ADDRESS =
  process.env.ENSTROLOGYP_PAY_ADDRESS || process.env.NEXT_PUBLIC_ENSTROLOGYP_PAY_ADDRESS;
const RESOLVER_ADDRESS = process.env.RESOLVER_ADDRESS || process.env.NEXT_PUBLIC_RESOLVER_ADDRESS;
const ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY;

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

if (!ORACLE_PRIVATE_KEY) {
  throw new Error('Missing ORACLE_PRIVATE_KEY');
}

// Clients
export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(SEPOLIA_RPC),
});

export const oracleWalletClient = createWalletClient({
  chain: sepolia,
  transport: http(SEPOLIA_RPC),
  account: privateKeyToAccount(ORACLE_PRIVATE_KEY as `0x${string}`),
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

export type OnChainReading = {
  buyer: `0x${string}`;
  sourceNamehash: `0x${string}`;
  purchasedAt: bigint;
  published: boolean;
};

export function computeSourceNamehash(sourceEnsName: string): `0x${string}` {
  const normalized = sourceEnsName.trim().toLowerCase();
  if (!normalized) {
    throw new Error('sourceEnsName cannot be empty');
  }
  return namehash(normalized);
}

export async function getReadingRecord(readingNamehash: `0x${string}`): Promise<OnChainReading> {
  if (!ENSTROLOGY_PAY_ADDRESS) {
    throw new Error('Missing ENSTROLOGYP_PAY_ADDRESS');
  }

  const reading = await publicClient.readContract({
    address: ENSTROLOGY_PAY_ADDRESS as `0x${string}`,
    abi: ENSTROLOGY_PAY_ABI,
    functionName: 'readings',
    args: [readingNamehash],
  });

  const [buyer, sourceNamehash, purchasedAt, published] = reading;
  return { buyer, sourceNamehash, purchasedAt, published };
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

// Helper: Generate horoscope using AI
export async function generateHoroscope(
  sourceEnsName: string,
  birthdateISO: string
): Promise<{
  sign: string;
  title: string;
  reading: string;
  luckyColor: string;
  luckyNumber: string;
}> {
  return {
    sign: 'Gemini',
    title: 'The Curious Builder',
    reading: `${sourceEnsName} was born on ${birthdateISO}. Your horoscope awaits.`,
    luckyColor: 'Electric violet',
    luckyNumber: '7',
  };
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
