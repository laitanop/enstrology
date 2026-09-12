"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { sepolia } from "wagmi/chains";

export const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
  56: "BNB Chain",
  137: "Polygon",
  8453: "Base",
  42161: "Arbitrum",
  43114: "Avalanche",
  11155111: "Sepolia",
  84532: "Base Sepolia",
  11155420: "OP Sepolia",
};

export function chainLabel(chainId?: number): string {
  if (!chainId) return "Unknown";
  return CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
}

function parseChainId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }
  const parsed = value.startsWith("0x")
    ? Number.parseInt(value, 16)
    : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

type WalletProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
};

type Eip6963Detail = {
  info?: { rdns?: string; name?: string };
  provider?: WalletProvider;
};

const providers = new Map<string, WalletProvider>();
const providerListeners = new Set<() => void>();

function notifyProviders() {
  for (const listener of providerListeners) listener();
}

function rememberProvider(rdns: string, provider: WalletProvider) {
  if (providers.has(rdns)) return;
  providers.set(rdns, provider);
  notifyProviders();
}

function startProviderDiscovery() {
  if (typeof window === "undefined" || startProviderDiscovery.started) return;
  startProviderDiscovery.started = true;

  const onAnnounce = (event: Event) => {
    const detail = (event as CustomEvent<Eip6963Detail>).detail;
    if (detail?.info?.rdns && detail.provider) {
      rememberProvider(detail.info.rdns, detail.provider);
    }
  };

  window.addEventListener("eip6963:announceProvider", onAnnounce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

startProviderDiscovery.started = false;

function sameAddress(left?: string, right?: string): boolean {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

async function providerAccounts(provider: WalletProvider): Promise<string[]> {
  try {
    const accounts = await provider.request({ method: "eth_accounts" });
    return Array.isArray(accounts)
      ? accounts.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

async function providerChainId(
  provider: WalletProvider,
): Promise<number | undefined> {
  try {
    return parseChainId(await provider.request({ method: "eth_chainId" }));
  } catch {
    return undefined;
  }
}

function isMetaMaskRdns(rdns: string): boolean {
  return rdns.startsWith("io.metamask");
}

async function pickProvider(address?: string): Promise<WalletProvider | undefined> {
  startProviderDiscovery();

  const entries = [...providers.entries()];
  const metamask = entries.find(([rdns]) => isMetaMaskRdns(rdns))?.[1];

  if (address) {
    for (const [rdns, provider] of entries) {
      if (!isMetaMaskRdns(rdns)) continue;
      const accounts = await providerAccounts(provider);
      if (accounts.some((item) => sameAddress(item, address))) {
        return provider;
      }
    }
  }

  if (metamask) return metamask;

  if (address) {
    for (const [, provider] of entries) {
      const accounts = await providerAccounts(provider);
      if (accounts.some((item) => sameAddress(item, address))) {
        return provider;
      }
    }
  }

  return entries[0]?.[1];
}

export async function switchWalletChain(chainId: number): Promise<void> {
  const provider = await pickProvider();
  if (!provider) {
    throw new Error("No wallet found.");
  }

  const hex = `0x${chainId.toString(16)}`;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hex }],
    });
    return;
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? Number((error as { code?: number }).code)
        : 0;
    if (code !== 4902 || chainId !== sepolia.id) {
      throw error;
    }
  }

  await provider.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: hex,
        chainName: "Sepolia",
        nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
        rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
        blockExplorerUrls: ["https://sepolia.etherscan.io"],
      },
    ],
  });
}

export function useWalletNetwork() {
  const { isConnected, address } = useAccount();
  const [chainId, setChainId] = useState<number | undefined>();

  useEffect(() => {
    startProviderDiscovery();

    if (!isConnected) {
      setChainId(undefined);
      return;
    }

    let cancelled = false;
    const attached: Array<{
      provider: WalletProvider;
      handler: (...args: unknown[]) => void;
    }> = [];

    const read = async () => {
      const provider = await pickProvider(address);
      if (!provider || cancelled) return;
      const next = await providerChainId(provider);
      if (!cancelled && next) setChainId(next);
    };

    const attach = () => {
      for (const provider of providers.values()) {
        if (attached.some((item) => item.provider === provider)) continue;
        const handler = () => {
          void read();
        };
        provider.on?.("chainChanged", handler);
        attached.push({ provider, handler });
      }
      void read();
    };

    providerListeners.add(attach);
    attach();

    const interval = window.setInterval(() => {
      void read();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      providerListeners.delete(attach);
      for (const { provider, handler } of attached) {
        provider.removeListener?.("chainChanged", handler);
        provider.off?.("chainChanged", handler);
      }
    };
  }, [address, isConnected]);

  return {
    chainId,
    chainName: chainId ? chainLabel(chainId) : undefined,
    isConnected,
  };
}
