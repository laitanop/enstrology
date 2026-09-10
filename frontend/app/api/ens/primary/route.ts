import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, isAddress } from "viem";
import { mainnet, sepolia } from "viem/chains";
import { findRecentlyRegisteredName } from "@/lib/ens-v2";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAINNET_RPC_URL =
  process.env.MAINNET_RPC_URL || "https://ethereum-rpc.publicnode.com";
const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL ||
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
  "https://ethereum-sepolia-rpc.publicnode.com";
const ENS_SUBGRAPH_ID = process.env.ENS_SUBGRAPH_ID;
const ENS_NAME_REGEX = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/;

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(MAINNET_RPC_URL),
});
const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http(SEPOLIA_RPC_URL),
});

type GraphResponse = {
  data?: {
    account?: {
      registrations?: Array<{
        domain?: {
          name?: string;
        };
      }>;
      domains?: Array<{
        name?: string;
      }>;
      wrappedDomains?: Array<{
        name?: string;
        domain?: {
          name?: string;
        };
      }>;
    };
  };
  errors?: Array<{ message?: string }>;
};

function getSubgraphUrl(): string {
  const graphKey = process.env.THE_GRAPH_API_KEY;
  if (!graphKey) {
    return "https://api.thegraph.com/subgraphs/name/ensdomains/ens";
  }
  return `https://gateway.thegraph.com/api/${graphKey}/subgraphs/id/${ENS_SUBGRAPH_ID}`;
}

function pickPreferredEnsName(candidates: string[]): string | null {
  if (!candidates.length) {
    return null;
  }

  const unique = Array.from(
    new Set(
      candidates
        .map((item) => item.trim().toLowerCase())
        .filter((item) => ENS_NAME_REGEX.test(item)),
    ),
  );

  if (!unique.length) {
    return null;
  }

  const sorted = unique.sort((a, b) => {
    const aIsEth = a.endsWith(".eth") ? 1 : 0;
    const bIsEth = b.endsWith(".eth") ? 1 : 0;
    if (aIsEth !== bIsEth) {
      return bIsEth - aIsEth;
    }

    const aParts = a.split(".").length;
    const bParts = b.split(".").length;
    if (aParts !== bParts) {
      return aParts - bParts;
    }

    return a.length - b.length;
  });

  return sorted[0] || null;
}

async function detectOwnedEnsName(address: string): Promise<string | null> {
  const query = `
    query OwnedNames($id: ID!) {
      account(id: $id) {
        registrations(first: 25, orderBy: registrationDate, orderDirection: desc) {
          domain { name }
        }
        domains(first: 25) {
          name
        }
        wrappedDomains(first: 25) {
          name
          domain { name }
        }
      }
    }
  `;

  try {
    const response = await fetch(getSubgraphUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { id: address.toLowerCase() },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as GraphResponse;
    if (json.errors?.length) {
      return null;
    }

    const account = json.data?.account;
    if (!account) {
      return null;
    }

    const candidates = [
      ...(account.registrations || []).map((item) => item.domain?.name || ""),
      ...(account.domains || []).map((item) => item.name || ""),
      ...(account.wrappedDomains || []).flatMap((item) => [
        item.name || "",
        item.domain?.name || "",
      ]),
    ];

    return pickPreferredEnsName(candidates);
  } catch {
    return null;
  }
}

async function detectReverseName(
  client: typeof mainnetClient | typeof sepoliaClient,
  address: `0x${string}`,
): Promise<string | null> {
  try {
    return (await client.getEnsName({ address })) || null;
  } catch {
    return null;
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!address || !isAddress(address)) {
    return NextResponse.json(
      { error: "Invalid wallet address" },
      { status: 400 },
    );
  }

  try {
    const wallet = address as `0x${string}`;

    // Cheap lookups first. The recent-event scan can exceed Vercel's time budget.
    const sepoliaEnsName = await detectReverseName(sepoliaClient, wallet);
    if (sepoliaEnsName) {
      return NextResponse.json({
        ensName: sepoliaEnsName,
        source: "sepolia-reverse",
      });
    }

    const mainnetEnsName = await detectReverseName(mainnetClient, wallet);
    if (mainnetEnsName) {
      return NextResponse.json({
        ensName: mainnetEnsName,
        source: "mainnet-reverse",
      });
    }

    const ownedEnsName = await detectOwnedEnsName(wallet);
    if (ownedEnsName) {
      return NextResponse.json({ ensName: ownedEnsName, source: "owned-name" });
    }

    const recentlyRegisteredName = await withTimeout(
      findRecentlyRegisteredName(wallet),
      process.env.VERCEL ? 8_000 : 20_000,
    );
    if (recentlyRegisteredName) {
      return NextResponse.json({
        ensName: recentlyRegisteredName,
        source: "ensv2-recent-registration",
      });
    }

    return NextResponse.json({ ensName: null, source: "not-found" });
  } catch {
    return NextResponse.json({ ensName: null, source: "lookup-failed" });
  }
}
