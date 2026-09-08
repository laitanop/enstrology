'use client';

import { useActionState, useMemo, useState, useTransition, type FormEvent } from 'react';
import { createPublicClient, createWalletClient, custom, http, namehash } from 'viem';
import { sepolia } from 'viem/chains';

type Horoscope = {
  sign: string;
  title: string;
  reading: string;
  luckyColor: string;
  luckyNumber: string;
};

export type CreateReadingState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  result?: {
    sourceEnsName: string;
    birthdate: string;
    readingNamehash: string;
    visibility: 'private' | 'public';
    horoscope: Horoscope;
    transactions: Record<string, string>;
  };
};

const INITIAL_STATE: CreateReadingState = {
  status: 'idle',
  message: '',
};

const ENS_NAME_REGEX = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/;
const PAY_ADDRESS = process.env.NEXT_PUBLIC_ENSTROLOGYP_PAY_ADDRESS as `0x${string}` | undefined;
const DEMO_USDC_ADDRESS = process.env.NEXT_PUBLIC_DEMO_USDC_ADDRESS as `0x${string}` | undefined;
const SEPOLIA_RPC =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const SEPOLIA_CHAIN_HEX = '0xaa36a7';
const PRICE = BigInt(10_000);

const DEMO_USDC_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const ENSTROLOGY_PAY_ABI = [
  {
    name: 'purchaseReading',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'sourceNamehash', type: 'bytes32' },
      { name: 'readingNamehash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'setReadingPublished',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'readingNamehash', type: 'bytes32' },
      { name: 'isPublic', type: 'bool' },
    ],
    outputs: [],
  },
] as const;

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

type CreateReadingFormProps = {
  action: (
    state: CreateReadingState,
    formData: FormData
  ) => Promise<CreateReadingState>;
};

function dateToCompact(dateISO: string): string {
  return dateISO.replaceAll('-', '');
}

function getReadingEnsName(sourceEnsName: string, birthdate: string): string {
  const sourceLabel = sourceEnsName.split('.')[0] || 'reading';
  const compactDate = dateToCompact(birthdate);
  return `${sourceLabel}-${compactDate}.oracle.enstrology.eth`;
}

export default function CreateReadingForm({ action }: CreateReadingFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [sourceEnsName, setSourceEnsName] = useState<string>('');
  const [birthdate, setBirthdate] = useState<string>('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [localError, setLocalError] = useState<string>('');
  const [flowMessage, setFlowMessage] = useState<string>('Connect wallet to start.');
  const [approveTxHash, setApproveTxHash] = useState<string>('');
  const [purchaseTxHash, setPurchaseTxHash] = useState<string>('');
  const [visibilityTxHash, setVisibilityTxHash] = useState<string>('');
  const [isPaying, setIsPaying] = useState<boolean>(false);
  const [isDetectingBirthday, setIsDetectingBirthday] = useState<boolean>(false);
  const [isDispatchPending, startDispatchTransition] = useTransition();

  const isBusy = isPending || isPaying || isDispatchPending || isDetectingBirthday;

  const readingPreview = useMemo(() => {
    const normalized = sourceEnsName.trim().toLowerCase();
    if (!normalized || !birthdate || !ENS_NAME_REGEX.test(normalized)) {
      return { readingEnsName: '', readingNamehash: '' };
    }
    const readingEnsName = getReadingEnsName(normalized, birthdate);
    return {
      readingEnsName,
      readingNamehash: namehash(readingEnsName),
    };
  }, [sourceEnsName, birthdate]);

  const getProvider = (): EthereumProvider => {
    if (!window.ethereum) {
      throw new Error('No wallet found. Install MetaMask or another EVM wallet.');
    }
    return window.ethereum;
  };

  const connectWallet = async (): Promise<`0x${string}`> => {
    const provider = getProvider();
    const accounts = (await provider.request({
      method: 'eth_requestAccounts',
    })) as string[];
    const wallet = accounts[0];
    if (!wallet) {
      throw new Error('Wallet connection failed.');
    }
    setWalletAddress(wallet);
    return wallet as `0x${string}`;
  };

  const detectPrimaryEnsFromWallet = async (wallet: string): Promise<void> => {
    try {
      const response = await fetch(
        `/api/ens/primary?address=${encodeURIComponent(wallet)}`,
        { cache: 'no-store' }
      );
      if (!response.ok) {
        return;
      }
      const json = (await response.json()) as { ensName?: string | null };
      const detectedEns = (json.ensName || '').toLowerCase();
      if (detectedEns && !sourceEnsName.trim()) {
        setSourceEnsName(detectedEns);
      }
    } catch {
      // Non-blocking helper.
    }
  };

  const detectBirthday = async (): Promise<void> => {
    setLocalError('');
    const normalizedEns = sourceEnsName.trim().toLowerCase();
    if (!ENS_NAME_REGEX.test(normalizedEns)) {
      setLocalError('Enter a valid ENS name first (example: pamela.eth).');
      return;
    }

    setIsDetectingBirthday(true);
    setFlowMessage('Detecting ENS birthday...');
    try {
      const response = await fetch(
        `/api/ens/birthday?name=${encodeURIComponent(normalizedEns)}`,
        { cache: 'no-store' }
      );
      const json = (await response.json()) as {
        birthdateISO?: string;
        error?: string;
      };
      if (!response.ok || !json.birthdateISO) {
        throw new Error(json.error || 'Could not detect ENS birthday.');
      }

      setBirthdate(json.birthdateISO);
      setFlowMessage(`Birthday detected: ${json.birthdateISO}`);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Could not detect ENS birthday.');
      setFlowMessage('Birthday detection failed.');
    } finally {
      setIsDetectingBirthday(false);
    }
  };

  const ensureSepolia = async (): Promise<void> => {
    const provider = getProvider();
    const chainId = (await provider.request({ method: 'eth_chainId' })) as string;
    if (chainId.toLowerCase() === SEPOLIA_CHAIN_HEX) {
      return;
    }
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SEPOLIA_CHAIN_HEX }],
    });
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setLocalError('');

    const normalizedEns = sourceEnsName.trim().toLowerCase();
    if (!ENS_NAME_REGEX.test(normalizedEns)) {
      setLocalError('Please enter a valid ENS name like pamela.eth.');
      return;
    }
    if (!birthdate || Number.isNaN(Date.parse(birthdate))) {
      setLocalError('Please enter a valid birthdate.');
      return;
    }
    if (!readingPreview.readingNamehash) {
      setLocalError('Could not compute readingNamehash.');
      return;
    }
    if (!PAY_ADDRESS || !DEMO_USDC_ADDRESS) {
      setLocalError('Missing NEXT_PUBLIC_ENSTROLOGYP_PAY_ADDRESS or NEXT_PUBLIC_DEMO_USDC_ADDRESS.');
      return;
    }

    setIsPaying(true);
    setApproveTxHash('');
    setPurchaseTxHash('');
    setVisibilityTxHash('');

    try {
      setFlowMessage('Connecting wallet...');
      const connectedWallet = walletAddress
        ? (walletAddress as `0x${string}`)
        : await connectWallet();

      setFlowMessage('Switching to Sepolia...');
      await ensureSepolia();

      const provider = getProvider();
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(SEPOLIA_RPC),
      });
      const walletClient = createWalletClient({
        chain: sepolia,
        transport: custom(provider),
      });

      const sourceNamehash = namehash(normalizedEns);
      const readingNamehash = readingPreview.readingNamehash as `0x${string}`;

      setFlowMessage('Validating contract addresses...');
      const payCode = await publicClient.getCode({ address: PAY_ADDRESS });
      if (!payCode || payCode === '0x') {
        throw new Error(
          `ENStrologyPay is not deployed at ${PAY_ADDRESS} on Sepolia. Update NEXT_PUBLIC_ENSTROLOGYP_PAY_ADDRESS.`
        );
      }
      const usdcCode = await publicClient.getCode({ address: DEMO_USDC_ADDRESS });
      if (!usdcCode || usdcCode === '0x') {
        throw new Error(
          `Demo USDC is not deployed at ${DEMO_USDC_ADDRESS} on Sepolia. Update NEXT_PUBLIC_DEMO_USDC_ADDRESS.`
        );
      }

      setFlowMessage('Approving 0.01 demo USDC...');
      const approveHash = await walletClient.writeContract({
        account: connectedWallet,
        address: DEMO_USDC_ADDRESS,
        abi: DEMO_USDC_ABI,
        functionName: 'approve',
        args: [PAY_ADDRESS, PRICE],
      });
      setApproveTxHash(approveHash);
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      setFlowMessage('Paying ENStrology (purchaseReading)...');
      const purchaseHash = await walletClient.writeContract({
        account: connectedWallet,
        address: PAY_ADDRESS,
        abi: ENSTROLOGY_PAY_ABI,
        functionName: 'purchaseReading',
        args: [sourceNamehash, readingNamehash],
      });
      setPurchaseTxHash(purchaseHash);
      await publicClient.waitForTransactionReceipt({ hash: purchaseHash });

      if (visibility === 'public') {
        setFlowMessage('Setting visibility to public...');
        const visibilityHash = await walletClient.writeContract({
          account: connectedWallet,
          address: PAY_ADDRESS,
          abi: ENSTROLOGY_PAY_ABI,
          functionName: 'setReadingPublished',
          args: [readingNamehash, true],
        });
        setVisibilityTxHash(visibilityHash);
        await publicClient.waitForTransactionReceipt({ hash: visibilityHash });
      }

      setFlowMessage('Payment complete. Generating horoscope and writing ENS text records...');
      const formData = new FormData();
      formData.set('sourceEnsName', normalizedEns);
      formData.set('birthdate', birthdate);
      formData.set('readingNamehash', readingNamehash);
      formData.set('visibility', visibility);

      startDispatchTransition(() => {
        formAction(formData);
      });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Transaction failed.');
      setFlowMessage('Flow stopped.');
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h1 className="text-2xl font-semibold tracking-tight">Create Reading</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Connect wallet, pay 0.01 demo USDC, then write horoscope text records onchain.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={async () => {
            try {
              setLocalError('');
              setFlowMessage('Connecting wallet...');
              const wallet = await connectWallet();
              await ensureSepolia();
              await detectPrimaryEnsFromWallet(wallet);
              setFlowMessage('Wallet connected on Sepolia.');
            } catch (error) {
              setLocalError(error instanceof Error ? error.message : 'Could not connect wallet.');
              setFlowMessage('Connection failed.');
            }
          }}
          disabled={isBusy}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {walletAddress ? 'Wallet Connected' : 'Connect Wallet'}
        </button>
        <span className="text-xs text-zinc-600 dark:text-zinc-400">
          {walletAddress || 'No wallet connected'}
        </span>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="space-y-1">
          <label htmlFor="sourceEnsName" className="text-sm font-medium">
            sourceEnsName
          </label>
          <input
            id="sourceEnsName"
            name="sourceEnsName"
            type="text"
            placeholder="pamela.eth"
            required
            value={sourceEnsName}
            onChange={(event) => setSourceEnsName(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="birthdate" className="text-sm font-medium">
              birthdate
            </label>
            <button
              type="button"
              onClick={detectBirthday}
              disabled={isBusy}
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Detect ENS Birthday
            </button>
          </div>
          <input
            id="birthdate"
            name="birthdate"
            type="date"
            required
            value={birthdate}
            onChange={(event) => setBirthdate(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Detects the ENS registration date and fills this field automatically.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="readingNamehash" className="text-sm font-medium">
            readingNamehash (auto-computed)
          </label>
          <input
            id="readingNamehash"
            name="readingNamehash"
            type="text"
            value={readingPreview.readingNamehash}
            readOnly
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          {readingPreview.readingEnsName ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              reading ENS: {readingPreview.readingEnsName}
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="visibility" className="text-sm font-medium">
            visibility
          </label>
          <select
            id="visibility"
            name="visibility"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as 'private' | 'public')}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="private">private</option>
            <option value="public">public</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isBusy}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? 'Processing...' : 'Pay & Create Horoscope'}
        </button>
      </form>

      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        {flowMessage}
      </div>

      {localError ? (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {localError}
        </div>
      ) : null}

      {approveTxHash || purchaseTxHash || visibilityTxHash ? (
        <div className="mt-4 space-y-1 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
          <p className="font-medium text-sm">Payment Transactions</p>
          {approveTxHash ? <p>approve: {approveTxHash}</p> : null}
          {purchaseTxHash ? <p>purchaseReading: {purchaseTxHash}</p> : null}
          {visibilityTxHash ? <p>setReadingPublished: {visibilityTxHash}</p> : null}
        </div>
      ) : null}

      {state.message ? (
        <div
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            state.status === 'error'
              ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
              : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
          }`}
        >
          {state.message}
        </div>
      ) : null}

      {state.result ? (
        <div className="mt-6 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p>
            <span className="font-medium">ENS:</span> {state.result.sourceEnsName}
          </p>
          <p>
            <span className="font-medium">Birthdate:</span> {state.result.birthdate}
          </p>
          <p>
            <span className="font-medium">Reading:</span> {state.result.readingNamehash}
          </p>
          <p>
            <span className="font-medium">Visibility:</span> {state.result.visibility}
          </p>

          <div className="pt-1">
            <p className="font-medium">Horoscope</p>
            <p className="mt-1">
              {state.result.horoscope.sign} — {state.result.horoscope.title}
            </p>
            <p className="mt-1 text-zinc-700 dark:text-zinc-300">
              {state.result.horoscope.reading}
            </p>
            <p className="mt-1 text-zinc-700 dark:text-zinc-300">
              Lucky color: {state.result.horoscope.luckyColor} | Lucky number:{' '}
              {state.result.horoscope.luckyNumber}
            </p>
          </div>

          <div className="pt-1">
            <p className="font-medium">Generated Text</p>
            <div className="mt-1 rounded-lg border border-zinc-200 bg-white p-3 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
              <p className="whitespace-pre-wrap break-words">
                {state.result.horoscope.reading}
              </p>
            </div>
          </div>

          <div className="pt-1">
            <p className="font-medium">Transactions</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {Object.entries(state.result.transactions).map(([key, hash]) => (
                <li key={key}>
                  {key}: {hash}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
