"use client";

import { useEffect, useState } from "react";
import { useChainId } from "wagmi";

function parseChainId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return undefined;
}

export function useWalletChainId(rainbowKitChainId?: number): number | undefined {
  const wagmiChainId = useChainId();
  const [injectedChainId, setInjectedChainId] = useState<number | undefined>();

  useEffect(() => {
    const ethereum = window.ethereum as
      | {
          request?: (args: { method: string }) => Promise<unknown>;
          on?: (event: string, handler: (chainId: string) => void) => void;
          removeListener?: (
            event: string,
            handler: (chainId: string) => void,
          ) => void;
        }
      | undefined;

    if (!ethereum?.request) {
      return;
    }

    const sync = (value: unknown) => {
      const next = parseChainId(value);
      if (next) {
        setInjectedChainId(next);
      }
    };

    void ethereum.request({ method: "eth_chainId" }).then(sync).catch(() => {
      // Keep wagmi / RainbowKit as fallback.
    });

    const onChange = (chainId: string) => sync(chainId);
    ethereum.on?.("chainChanged", onChange);
    return () => ethereum.removeListener?.("chainChanged", onChange);
  }, []);

  return injectedChainId || rainbowKitChainId || wagmiChainId;
}
