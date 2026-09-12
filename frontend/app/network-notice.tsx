"use client";

import { useEffect, useState } from "react";
import { sepolia } from "wagmi/chains";
import {
  chainLabel,
  switchWalletChain,
  useWalletNetwork,
} from "@/lib/wallet-network";

const ENS_V2_EXPLORER = "https://explorer.ens.dev/";

export default function NetworkNotice() {
  const { isConnected, chainId } = useWalletNetwork();
  const [isPending, setIsPending] = useState(false);

  const switchToSepolia = async () => {
    setIsPending(true);
    try {
      await switchWalletChain(sepolia.id);
    } finally {
      setIsPending(false);
    }
  };

  useEffect(() => {
    if (!isConnected || !chainId || chainId === sepolia.id) return;
    const key = "enstrology:asked-sepolia-switch";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void switchToSepolia();
  }, [chainId, isConnected]);

  if (!isConnected || !chainId || chainId === sepolia.id) {
    return null;
  }

  const currentName = chainLabel(chainId);

  return (
    <div
      className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-50"
      role="status"
    >
      <p className="font-medium text-amber-100">This site is on {currentName}</p>
      <p className="mt-2 leading-6 text-amber-100/85">
        MetaMask’s home “Network: Sepolia” filter only changes your token list.
        To change this app, tap the connected-site icon in MetaMask and pick
        Sepolia, or tap below.
      </p>
      <p className="mt-2 leading-6 text-amber-100/85">
        You also need a Sepolia ENSv2 name from the{" "}
        <a
          href={ENS_V2_EXPLORER}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-white underline underline-offset-2"
        >
          ENS Explorer
        </a>
        .
      </p>
      <button
        type="button"
        onClick={() => void switchToSepolia()}
        disabled={isPending}
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#C4B5FD] px-5 text-sm font-semibold text-[#1B1233] transition hover:bg-[#d4c8ff] disabled:opacity-60"
      >
        {isPending ? "Switching…" : "Use Sepolia for this site"}
      </button>
    </div>
  );
}
