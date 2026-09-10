import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  phantomWallet,
  rainbowWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { http } from 'wagmi';
import { sepolia } from 'wagmi/chains';

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
  chains: [sepolia],
  ssr: true,
  transports: {
    [sepolia.id]: http(sepoliaRpc),
  },
  wallets: [
    {
      groupName: 'Suggested',
      wallets: [rainbowWallet, metaMaskWallet, phantomWallet, walletConnectWallet],
    },
  ],
});
