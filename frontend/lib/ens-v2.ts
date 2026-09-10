import { createPublicClient, http, parseAbiItem } from 'viem';
import { labelhash } from 'viem/ens';
import { sepolia } from 'viem/chains';

const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL ||
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
  'https://ethereum-sepolia-rpc.publicnode.com';

function getEnsV2EthRegistry(): `0x${string}` | null {
  const address = process.env.ENS_V2_ETH_REGISTRY?.trim();
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return null;
  }
  return address as `0x${string}`;
}

const ENS_V2_REGISTRY_ABI = [
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http(SEPOLIA_RPC_URL),
});

// ENSv2 token ids carry a version in their low 32 bits, so compare on the labelhash prefix only.
function getRegistryTokenId(label: string): bigint {
  return (BigInt(labelhash(label)) >> BigInt(32)) << BigInt(32);
}

function isSecondLevelEthName(name: string): boolean {
  return name.endsWith('.eth') && name.split('.').length === 2;
}

/**
 * Reads the ENSv2 registry owner of a second-level `.eth` name. Returns null when the name is not
 * a second-level `.eth` name, is unregistered, or the registry call fails.
 */
export async function getEnsV2Owner(name: string): Promise<`0x${string}` | null> {
  const normalized = name.trim().toLowerCase();
  if (!isSecondLevelEthName(normalized)) {
    return null;
  }

  const registry = getEnsV2EthRegistry();
  if (!registry) {
    return null;
  }

  try {
    const owner = await sepoliaClient.readContract({
      address: registry,
      abi: ENS_V2_REGISTRY_ABI,
      functionName: 'ownerOf',
      args: [getRegistryTokenId(normalized.split('.')[0])],
    });
    return owner.toLowerCase() === ZERO_ADDRESS ? null : owner;
  } catch {
    return null;
  }
}

export async function isEnsV2Owner(name: string, address: string): Promise<boolean> {
  const owner = await getEnsV2Owner(name);
  return Boolean(owner && owner.toLowerCase() === address.trim().toLowerCase());
}

/**
 * Birthday for an ENSv2 Sepolia .eth name: the block time of its LabelRegistered event.
 */
export async function getEnsV2RegistrationBirthday(
  name: string
): Promise<{ birthdateISO: string; registrationDateUnix: number } | null> {
  const normalized = name.trim().toLowerCase();
  if (!isSecondLevelEthName(normalized)) {
    return null;
  }

  const registry = getEnsV2EthRegistry();
  if (!registry) {
    return null;
  }

  const label = normalized.split('.')[0];
  const hashedLabel = labelhash(label);

  const latestBlock = await sepoliaClient.getBlockNumber();
  const earliestBlock = latestBlock > SCAN_BLOCKS ? latestBlock - SCAN_BLOCKS : BigInt(0);

  for (let toBlock = latestBlock; toBlock > earliestBlock; toBlock -= SCAN_CHUNK) {
    const fromBlock =
      toBlock > earliestBlock + SCAN_CHUNK ? toBlock - SCAN_CHUNK + BigInt(1) : earliestBlock;

    try {
      const logs = await sepoliaClient.getLogs({
        address: registry,
        event: LABEL_REGISTERED_EVENT,
        args: { labelHash: hashedLabel },
        fromBlock,
        toBlock,
      });
      const match = logs.reverse().find((log) => log.args.label?.toLowerCase() === label);
      if (!match?.blockNumber) {
        continue;
      }

      const block = await sepoliaClient.getBlock({ blockNumber: match.blockNumber });
      const registrationDateUnix = Number(block.timestamp);
      return {
        birthdateISO: new Date(registrationDateUnix * 1000).toISOString().slice(0, 10),
        registrationDateUnix,
      };
    } catch {
      continue;
    }
  }

  return null;
}

// On-chain event name is LabelRegistered (not NameRegistered). tokenId and labelHash are indexed.
const LABEL_REGISTERED_EVENT = parseAbiItem(
  'event LabelRegistered(uint256 indexed tokenId, bytes32 indexed labelHash, string label, address owner, uint64 expiry, address indexed sender)'
);
const TRANSFER_SINGLE_EVENT = parseAbiItem(
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)'
);
const SCAN_BLOCKS = BigInt(process.env.ENS_V2_SCAN_BLOCKS || '200000');
const SCAN_CHUNK = BigInt(process.env.ENS_V2_SCAN_CHUNK || '10000');
const SCAN_PARALLEL = 4;

async function labelFromTokenMint(
  registry: `0x${string}`,
  tokenId: bigint,
  blockNumber: bigint
): Promise<string | null> {
  try {
    const [registration] = await sepoliaClient.getLogs({
      address: registry,
      event: LABEL_REGISTERED_EVENT,
      args: { tokenId },
      fromBlock: blockNumber,
      toBlock: blockNumber,
    });
    return registration?.args.label?.toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * ENSv2 cannot list every name an address owns with one contract call.
 * TransferSingle indexes `to`, so we can query this wallet's receipts without
 * knowing the name in advance (no candidate list).
 */
export async function findRecentlyRegisteredName(
  address: `0x${string}`
): Promise<string | null> {
  const target = address.toLowerCase() as `0x${string}`;
  const registry = getEnsV2EthRegistry();
  if (!registry) {
    return null;
  }

  const latestBlock = await sepoliaClient.getBlockNumber();
  const earliestBlock = latestBlock > SCAN_BLOCKS ? latestBlock - SCAN_BLOCKS : BigInt(0);
  const ranges: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
  for (let toBlock = latestBlock; toBlock > earliestBlock; toBlock -= SCAN_CHUNK) {
    const fromBlock =
      toBlock > earliestBlock + SCAN_CHUNK ? toBlock - SCAN_CHUNK + BigInt(1) : earliestBlock;
    ranges.push({ fromBlock, toBlock });
  }

  for (let i = 0; i < ranges.length; i += SCAN_PARALLEL) {
    const batch = ranges.slice(i, i + SCAN_PARALLEL);
    const groups = await Promise.all(
      batch.map(async ({ fromBlock, toBlock }) => {
        try {
          return await sepoliaClient.getLogs({
            address: registry,
            event: TRANSFER_SINGLE_EVENT,
            args: { to: target },
            fromBlock,
            toBlock,
          });
        } catch {
          return [];
        }
      }),
    );

    for (const logs of groups) {
      for (const transfer of [...logs].reverse()) {
        const tokenId = transfer.args.id;
        if (tokenId === undefined || transfer.blockNumber === null) {
          continue;
        }

        const label = await labelFromTokenMint(registry, tokenId, transfer.blockNumber);
        if (!label) {
          continue;
        }

        const name = `${label}.eth`;
        if (await isEnsV2Owner(name, target)) {
          return name;
        }
      }
    }
  }

  return null;
}
