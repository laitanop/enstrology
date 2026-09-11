"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

type Eip1193Provider = {
  request: (args: { method: string }) => Promise<unknown>;
  on?: (event: string, handler: (chainId: string) => void) => void;
  removeListener?: (event: string, handler: (chainId: string) => void) => void;
};

type Eip6963Detail = {
  provider?: Eip1193Provider;
};

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

export function useWalletChainId(rainbowKitChainId?: number): number | undefined {
  const { chainId: accountChainId, connector } = useAccount();
  const [providerChainId, setProviderChainId] = useState<number | undefined>();

  useEffect(() => {
    let cancelled = false;
    let activeProvider: Eip1193Provider | undefined;
    let stopPoll: (() => void) | undefined;
    let announceTimer: number | undefined;
    const announced: Eip6963Detail[] = [];

    const apply = (value: unknown) => {
      const next = parseChainId(value);
      if (!cancelled && next) {
        setProviderChainId(next);
      }
    };

    const listen = (provider: Eip1193Provider) => {
      if (cancelled || activeProvider) {
        return;
      }
      activeProvider = provider;
      const read = () =>
        provider.request({ method: "eth_chainId" }).then(apply).catch(() => {
          // Ignore locked / unauthorized providers.
        });
      void read();
      const poll = window.setInterval(() => void read(), 1500);
      provider.on?.("chainChanged", apply);
      stopPoll = () => window.clearInterval(poll);
    };

    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<Eip6963Detail>).detail;
      if (detail?.provider) {
        announced.push(detail);
      }
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    void (async () => {
      // Ask the wallet we are actually connected through. window.ethereum belongs to
      // whichever extension won the injection race, which need not be that wallet.
      const connectorProvider = connector?.getProvider
        ? ((await Promise.resolve(connector.getProvider()).catch(() => undefined)) as
            | Eip1193Provider
            | undefined)
        : undefined;

      if (connectorProvider?.request) {
        listen(connectorProvider);
        return;
      }

      // Nothing connected yet: fall back to whichever wallet announces itself.
      await new Promise<void>((resolve) => {
        announceTimer = window.setTimeout(resolve, 50);
      });
      const announcedProvider = announced.find(
        (detail) => detail.provider,
      )?.provider;
      if (announcedProvider) {
        listen(announcedProvider);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(announceTimer);
      stopPoll?.();
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      activeProvider?.removeListener?.("chainChanged", apply);
    };
  }, [connector]);

  return providerChainId || rainbowKitChainId || accountChainId;
}
