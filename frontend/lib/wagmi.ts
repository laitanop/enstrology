import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  phantomWallet,
  rainbowWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConnector, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import {
  arbitrum,
  base,
  baseSepolia,
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

const injectedMetaMaskWallet = () => ({
  id: 'metaMask',
  name: 'MetaMask',
  rdns: 'io.metamask',
  iconAccent: '#f6851a',
  iconBackground: '#ffffff',
  iconUrl: async () =>
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path fill="%23E2761B" d="M32.4 3.6 21.3 11.8l2.1-5z"/><path fill="%23E4761B" d="m7.6 3.6 11 8.3-2-5.1z"/><path fill="%23E4761B" d="m27.7 25.6-2.9 4.4 6.2 1.7 1.8-6.1z"/><path fill="%23E4761B" d="m7.2 25.6 1.8 6.1 6.2-1.7-2.9-4.4z"/><path fill="%23E4761B" d="m14.8 17.5-1.8 2.8 6.1.3-.2-6.6z"/><path fill="%23E4761B" d="m25.2 17.5-.2-3.6-.1 6.7 6.1-.3z"/></svg>',
  installed: true,
  createConnector: (walletDetails: Record<string, unknown>) =>
    createConnector((config) => ({
      ...injected({ target: 'metaMask' })(config),
      ...walletDetails,
    })),
});

export const wagmiConfig = getDefaultConfig({
  appName: 'ENStrology',
  projectId,
  chains: [sepolia, mainnet, base, optimism, arbitrum, polygon, baseSepolia],
  ssr: false,
  transports: {
    [sepolia.id]: http(sepoliaRpc),
    [mainnet.id]: http(),
    [base.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
    [polygon.id]: http(),
    [baseSepolia.id]: http(),
  },
  wallets: [
    {
      groupName: 'Suggested',
      wallets: [
        injectedMetaMaskWallet,
        rainbowWallet,
        phantomWallet,
        walletConnectWallet,
      ],
    },
  ],
});
