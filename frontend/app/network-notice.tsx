"use client";

import { useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { useWalletChainId } from "@/lib/wallet-chain";

const CHAIN_NAMES: Record<number, string> = {
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

const ENS_V2_EXPLORER = "https://explorer.ens.dev/";

export default function NetworkNotice() {
  const { isConnected } = useAccount();
  const chainId = useWalletChainId();
  const { switchChainAsync, isPending } = useSwitchChain();
  const [error, setError] = useState("");

  if (!isConnected || !chainId || chainId === sepolia.id) {
    return null;
  }

  const currentName = CHAIN_NAMES[chainId] || `chain ${chainId}`;

  const switchToSepolia = async () => {
    setError("");
    try {
      await switchChainAsync({ chainId: sepolia.id });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not switch networks. Open MetaMask and pick Sepolia.",
      );
    }
  };

  return (
    <div
      className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-50"
      role="status"
    >
      <p className="font-medium text-amber-100">Switch to Sepolia to use this demo</p>
      <p className="mt-2 leading-6 text-amber-100/85">
        You are connected on <span className="font-medium text-white">{currentName}</span>.
        ENStrology is an ETHOnline hackathon app on{" "}
        <span className="font-medium text-white">ENSv2 / Sepolia</span>, not mainnet
        ENS.
      </p>
      <p className="mt-2 leading-6 text-amber-100/85">
        After you switch, you need a Sepolia ENSv2 name for this wallet. Register
        one in the{" "}
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
        {isPending ? "Switching…" : "Switch to Sepolia"}
      </button>
      {error ? <p className="mt-2 text-xs text-rose-200">{error}</p> : null}
    </div>
  );
}
