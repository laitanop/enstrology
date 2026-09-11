'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { sepolia } from 'wagmi/chains';

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="walletMoon" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7DD3FC" />
          <stop offset="45%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#F0ABFC" />
        </linearGradient>
      </defs>
      <path
        fill="url(#walletMoon)"
        d="M42 8.5A23.5 23.5 0 1 0 42 55.5 19 19 0 1 1 42 8.5Z"
      />
      <path
        fill="url(#walletMoon)"
        d="M44.5 24.5 47.4 32.2 55.5 35.2 47.4 38.2 44.5 46 41.6 38.2 33.5 35.2 41.6 32.2Z"
      />
    </svg>
  );
}

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  56: 'BNB Chain',
  137: 'Polygon',
  8453: 'Base',
  42161: 'Arbitrum',
  43114: 'Avalanche',
  11155111: 'Sepolia',
  84532: 'Base Sepolia',
  11155420: 'OP Sepolia',
};

function networkLabel(chain?: {
  id?: number;
  name?: string;
} | null): string {
  if (!chain?.id) {
    return 'Unknown network';
  }
  return chain.name || CHAIN_NAMES[chain.id] || `Chain ${chain.id}`;
}

function NetworkBadge({
  onClick,
  connected,
  chain,
}: {
  onClick?: () => void;
  connected: boolean;
  chain?: { id: number; name?: string; unsupported?: boolean } | null;
}) {
  const onSepolia = Boolean(connected && chain?.id === sepolia.id);
  const unsupported = Boolean(connected && chain && !onSepolia);
  const label = !connected
    ? 'Not connected'
    : networkLabel(chain);

  const className = !connected
    ? 'inline-flex min-h-11 items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-sm font-medium text-zinc-400'
    : unsupported
      ? 'inline-flex min-h-11 items-center gap-2 rounded-full bg-amber-500/15 px-3 py-2 text-sm font-medium text-amber-300'
      : 'inline-flex min-h-11 items-center gap-2 rounded-full bg-[#10261c] px-3 py-2 text-sm font-medium text-emerald-300';
  const dotClass = !connected
    ? 'h-2 w-2 rounded-full bg-zinc-500'
    : unsupported
      ? 'h-2 w-2 rounded-full bg-amber-400'
      : 'h-2 w-2 rounded-full bg-emerald-400';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={className}
        title={
          unsupported
            ? `${label} — tap to switch to Sepolia`
            : label
        }
      >
        <span className={dotClass} />
        {label}
      </button>
    );
  }

  return (
    <span className={className}>
      <span className={dotClass} />
      {label}
    </span>
  );
}

export default function NavConnect() {
  const { isConnected, chainId } = useAccount();

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const connected = Boolean(mounted && account && isConnected);
        const activeChain = connected
          ? {
              id: chainId || chain?.id || 0,
              name:
                (chainId && CHAIN_NAMES[chainId]) ||
                chain?.name ||
                undefined,
            }
          : null;
        const networkBadge = (
          <NetworkBadge
            connected={connected}
            chain={activeChain}
            onClick={connected ? openChainModal : undefined}
          />
        );

        if (!mounted || !account) {
          return (
            <div className="flex items-center gap-2">
              {networkBadge}
              <button
                type="button"
                disabled={!mounted}
                onClick={openConnectModal}
                className="inline-flex items-center gap-2 rounded-full bg-[#C4B5FD] px-3.5 py-2 text-sm font-semibold text-[#1B1233] transition hover:bg-[#d4c8ff] disabled:opacity-70"
              >
                <MoonIcon className="h-5 w-5" />
                Connect wallet
              </button>
            </div>
          );
        }

        return (
          <div className="flex items-center gap-2">
            {networkBadge}
            <button
              type="button"
              onClick={openAccountModal}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#151326] py-1.5 pr-3 pl-1.5 text-sm font-medium text-zinc-100"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0b0818]">
                <MoonIcon className="h-5 w-5" />
              </span>
              {account.displayName}
              <span aria-hidden="true" className="text-xs text-zinc-500">
                ▾
              </span>
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
