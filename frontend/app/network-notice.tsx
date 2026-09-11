"use client";

import { useAccount } from "wagmi";
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

export default function NetworkNotice() {
  const { isConnected } = useAccount();
  const chainId = useWalletChainId();

  // This component now only detects the network from MetaMask
  // No prompts or buttons - just passive detection via the useWalletChainId hook
  // The network badge in the nav will show the current network automatically
  if (!isConnected || !chainId) {
    return null;
  }

  // Component returns null - network detection happens in the hook,
  // display happens in the nav badge component
  return null;
}
