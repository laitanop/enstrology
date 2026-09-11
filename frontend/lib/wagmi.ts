import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  phantomWallet,
  rainbowWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { http } from 'wagmi';
import {
  arbitrum,
  base,
  mainnet,
  optimism,
  polygon,
  sepolia,
} from 'wagmi/chains';

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  '00000000000000000000000000000001';

const sepoliaRpc =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
  process.env.SEPOLIA_RPC_URL ||
  'https://ethereum-sepolia-rpc.publicnode.com';

export const wagmiConfig = getDefaultConfig({
  appName: 'ENStrology',
  projectId,
  chains: [sepolia, mainnet, base, optimism, arbitrum, polygon],
  ssr: true,
  transports: {
    [sepolia.id]: http(sepoliaRpc),
    [mainnet.id]: http(),
    [base.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
    [polygon.id]: http(),
  },
  wallets: [
    {
      groupName: 'Suggested',
      wallets: [rainbowWallet, metaMaskWallet, phantomWallet, walletConnectWallet],
    },
  ],
});
