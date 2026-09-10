"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { createPublicClient, http, namehash } from "viem";
import { sepolia } from "viem/chains";
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";

type Horoscope = {
  sign: string;
  title: string;
  reading: string;
  luckyColor: string;
  luckyNumber: string;
};

export type CreateReadingState = {
  status: "idle" | "success" | "error";
  message: string;
  result?: {
    sourceEnsName: string;
    birthdate: string;
    readingNamehash: string;
    readingEnsName?: string;
    visibility: "private" | "public";
    horoscope: Horoscope;
    transactions: Record<string, string>;
  };
};

export type PermissionProofResult = {
  status: "success" | "expected_revert" | "unexpected_success" | "error";
  message: string;
  txHash?: string;
  targetEnsName?: string;
  oracleAddress?: string;
};

const INITIAL_STATE: CreateReadingState = {
  status: "idle",
  message: "",
};

const ENS_NAME_REGEX = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/;
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const PAY_ADDRESS = process.env.NEXT_PUBLIC_ENSTROLOGYP_PAY_ADDRESS as
  | `0x${string}`
  | undefined;
const DEMO_USDC_ADDRESS = process.env.NEXT_PUBLIC_DEMO_USDC_ADDRESS as
  | `0x${string}`
  | undefined;
const SEPOLIA_RPC =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
  "https://ethereum-sepolia-rpc.publicnode.com";
const PRICE = BigInt(10_000);

const DEMO_USDC_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const ENSTROLOGY_PAY_ABI = [
  {
    name: "purchaseReading",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "sourceNamehash", type: "bytes32" },
      { name: "readingNamehash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "setReadingPublished",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "readingNamehash", type: "bytes32" },
      { name: "isPublic", type: "bool" },
    ],
    outputs: [],
  },
] as const;

type CreateReadingFormProps = {
  action: (
    state: CreateReadingState,
    formData: FormData,
  ) => Promise<CreateReadingState>;
  forbiddenWriteAction: (input: {
    targetEnsName: string;
  }) => Promise<PermissionProofResult>;
  revokeOracleAction: (input: {
    permissionEnsName: string;
  }) => Promise<PermissionProofResult>;
  retryOracleWriteAction: (input: {
    targetEnsName: string;
  }) => Promise<PermissionProofResult>;
};

type OwnershipStatus = "idle" | "verifying" | "verified" | "unverified";

function dateToCompact(dateISO: string): string {
  return dateISO.replaceAll("-", "");
}

function formatBirthdate(dateISO: string): string {
  const parsed = new Date(`${dateISO}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return dateISO;
  }
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getZodiacSign(dateISO: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (!match) {
    return null;
  }
  const month = Number(match[2]);
  const day = Number(match[3]);
  const n = month * 100 + day;
  if (n >= 321 && n <= 419) return "Aries";
  if (n >= 420 && n <= 520) return "Taurus";
  if (n >= 521 && n <= 620) return "Gemini";
  if (n >= 621 && n <= 722) return "Cancer";
  if (n >= 723 && n <= 822) return "Leo";
  if (n >= 823 && n <= 922) return "Virgo";
  if (n >= 923 && n <= 1022) return "Libra";
  if (n >= 1023 && n <= 1121) return "Scorpio";
  if (n >= 1122 && n <= 1221) return "Sagittarius";
  if (n >= 1222 || n <= 119) return "Capricorn";
  if (n >= 120 && n <= 218) return "Aquarius";
  return "Pisces";
}

function birthdaySourceLabel(source: string): string {
  if (source === "ens-subgraph") {
    return "Verified from the mainnet registration event";
  }
  if (source === "ensv2-sepolia") {
    return "Verified from the Sepolia registration event";
  }
  return "Verified from the onchain registration event";
}

function getReadingEnsName(sourceEnsName: string, birthdate: string): string {
  const sourceLabel = sourceEnsName.split(".")[0] || "reading";
  const compactDate = dateToCompact(birthdate);
  return `${sourceLabel}-${compactDate}.oracle.enstrology.eth`;
}

export default function CreateReadingForm({
  action,
  forbiddenWriteAction,
  revokeOracleAction,
  retryOracleWriteAction,
}: CreateReadingFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const walletAddress = address || "";
  const previousAddressRef = useRef<string>("");
  const [sourceEnsName, setSourceEnsName] = useState<string>("");
  const [birthdate, setBirthdate] = useState<string>("");
  const [birthdaySource, setBirthdaySource] = useState<string>("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [localError, setLocalError] = useState<string>("");
  const [flowMessage, setFlowMessage] = useState<string>(
    "Connect wallet to start.",
  );
  const [approveTxHash, setApproveTxHash] = useState<string>("");
  const [purchaseTxHash, setPurchaseTxHash] = useState<string>("");
  const [visibilityTxHash, setVisibilityTxHash] = useState<string>("");
  const [isPaying, setIsPaying] = useState<boolean>(false);
  const [isDetectingBirthday, setIsDetectingBirthday] =
    useState<boolean>(false);
  const [ownershipStatus, setOwnershipStatus] =
    useState<OwnershipStatus>("idle");
  const [ownershipMessage, setOwnershipMessage] = useState<string>("");
  const [verifiedIdentityKey, setVerifiedIdentityKey] = useState<string>("");
  const [permissionNodeName, setPermissionNodeName] = useState<string>(
    "oracle.enstrology.eth",
  );
  const [forbiddenResult, setForbiddenResult] =
    useState<PermissionProofResult | null>(null);
  const [revokeResult, setRevokeResult] =
    useState<PermissionProofResult | null>(null);
  const [retryResult, setRetryResult] = useState<PermissionProofResult | null>(
    null,
  );
  const [isProofPending, startProofTransition] = useTransition();
  const [isDispatchPending, startDispatchTransition] = useTransition();
  const autoVerifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastAutoVerifyKeyRef = useRef<string>("");

  const isBusy =
    isPending ||
    isPaying ||
    isDispatchPending ||
    isDetectingBirthday ||
    isProofPending;

  const readingPreview = useMemo(() => {
    const normalized = sourceEnsName.trim().toLowerCase();
    if (!normalized || !birthdate || !ENS_NAME_REGEX.test(normalized)) {
      return { readingEnsName: "", readingNamehash: "" };
    }
    const readingEnsName = getReadingEnsName(normalized, birthdate);
    return {
      readingEnsName,
      readingNamehash: namehash(readingEnsName),
    };
  }, [sourceEnsName, birthdate]);

  const detectPrimaryEnsFromWallet = useCallback(
    async (wallet: string): Promise<string | null> => {
      try {
        const response = await fetch(
          `/api/ens/primary?address=${encodeURIComponent(wallet)}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          return null;
        }
        const json = (await response.json()) as { ensName?: string | null };
        const detectedEns = (json.ensName || "").toLowerCase();
        return detectedEns || null;
      } catch {
        // Non-blocking helper.
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    const nextWallet = walletAddress;
    const previousWallet = previousAddressRef.current;
    if (
      previousWallet &&
      previousWallet.toLowerCase() !== nextWallet.toLowerCase()
    ) {
      setSourceEnsName("");
      setBirthdate("");
      setBirthdaySource("");
      setOwnershipStatus("idle");
      setOwnershipMessage("");
      setVerifiedIdentityKey("");
      lastAutoVerifyKeyRef.current = "";
      setFlowMessage(
        nextWallet
          ? "Wallet account changed. Detecting ENS name..."
          : "Wallet disconnected.",
      );
    }
    previousAddressRef.current = nextWallet;
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress) {
      return;
    }

    let cancelled = false;

    void detectPrimaryEnsFromWallet(walletAddress).then((detectedEns) => {
      if (cancelled) {
        return;
      }

      if (detectedEns) {
        setSourceEnsName(detectedEns);
        setFlowMessage(`ENS detected: ${detectedEns}. Verifying ownership...`);
      } else {
        setFlowMessage(
          "Wallet connected, but no ENS name is linked to this account on Sepolia. Set a primary ENS name (or an address record) for it, or type the name below.",
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [walletAddress, detectPrimaryEnsFromWallet]);

  const detectBirthday = useCallback(
    async (ensName?: string): Promise<void> => {
      setLocalError("");
      const normalizedEns = (ensName || sourceEnsName).trim().toLowerCase();
      if (!ENS_NAME_REGEX.test(normalizedEns)) {
        setLocalError("Enter a valid ENS name first (example: pamela.eth).");
        return;
      }

      setIsDetectingBirthday(true);
      setFlowMessage("Detecting ENS birthday...");
      try {
        const response = await fetch(
          `/api/ens/birthday?name=${encodeURIComponent(normalizedEns)}`,
          { cache: "no-store" },
        );
        const json = (await response.json()) as {
          birthdateISO?: string;
          source?: string;
          error?: string;
        };
        if (!response.ok || !json.birthdateISO) {
          throw new Error(json.error || "Could not detect ENS birthday.");
        }

        setBirthdate(json.birthdateISO);
        setBirthdaySource(json.source || "");
        setFlowMessage(`Birthday detected: ${json.birthdateISO}`);
      } catch (error) {
        setLocalError(
          error instanceof Error
            ? error.message
            : "Could not detect ENS birthday.",
        );
        setFlowMessage("Birthday detection failed.");
      } finally {
        setIsDetectingBirthday(false);
      }
    },
    [sourceEnsName],
  );

  const verifyOwnership = useCallback(
    async (
      walletInput?: `0x${string}`,
      sourceInput?: string,
    ): Promise<boolean> => {
      const wallet = (walletInput || walletAddress).trim().toLowerCase();
      const source = (sourceInput || sourceEnsName).trim().toLowerCase();

      if (!wallet) {
        setLocalError("Connect your wallet first.");
        setOwnershipStatus("unverified");
        setOwnershipMessage("Wallet not connected.");
        return false;
      }
      if (!source) {
        setLocalError("Enter sourceEnsName first.");
        setOwnershipStatus("unverified");
        setOwnershipMessage("No source name/address provided.");
        return false;
      }

      setLocalError("");
      setOwnershipStatus("verifying");
      setOwnershipMessage("Checking ownership on Sepolia...");
      try {
        const response = await fetch(
          `/api/ens/verify-control?source=${encodeURIComponent(source)}&wallet=${encodeURIComponent(wallet)}`,
          { cache: "no-store" },
        );
        const json = (await response.json()) as {
          verified?: boolean;
          reason?: string;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(json.error || "Could not verify ownership");
        }

        const verified = Boolean(json.verified);
        const reason =
          json.reason ||
          (verified ? "Ownership verified." : "Ownership not verified.");
        setOwnershipStatus(verified ? "verified" : "unverified");
        setOwnershipMessage(reason);
        if (verified) {
          setVerifiedIdentityKey(`${wallet}|${source}`);
        }
        return verified;
      } catch (error) {
        setOwnershipStatus("unverified");
        setOwnershipMessage("Ownership check failed.");
        setLocalError(
          error instanceof Error
            ? error.message
            : "Could not verify ownership.",
        );
        return false;
      }
    },
    [walletAddress, sourceEnsName],
  );

  useEffect(() => {
    return () => {
      if (autoVerifyTimeoutRef.current) {
        clearTimeout(autoVerifyTimeoutRef.current);
        autoVerifyTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const wallet = walletAddress.trim().toLowerCase();
    const source = sourceEnsName.trim().toLowerCase();
    const isSourceVerifiable =
      ENS_NAME_REGEX.test(source) || ADDRESS_REGEX.test(source);

    if (!wallet || !isSourceVerifiable) {
      return;
    }

    const identityKey = `${wallet}|${source}`;
    const alreadyVerified =
      ownershipStatus === "verified" && verifiedIdentityKey === identityKey;
    if (alreadyVerified || ownershipStatus === "verifying") {
      return;
    }

    if (lastAutoVerifyKeyRef.current === identityKey) {
      return;
    }

    if (autoVerifyTimeoutRef.current) {
      clearTimeout(autoVerifyTimeoutRef.current);
      autoVerifyTimeoutRef.current = null;
    }

    autoVerifyTimeoutRef.current = setTimeout(() => {
      lastAutoVerifyKeyRef.current = identityKey;
      void verifyOwnership(wallet as `0x${string}`, source);
    }, 250);

    return () => {
      if (autoVerifyTimeoutRef.current) {
        clearTimeout(autoVerifyTimeoutRef.current);
        autoVerifyTimeoutRef.current = null;
      }
    };
  }, [
    walletAddress,
    sourceEnsName,
    ownershipStatus,
    verifiedIdentityKey,
    verifyOwnership,
  ]);

  useEffect(() => {
    const source = sourceEnsName.trim().toLowerCase();
    if (
      ownershipStatus !== "verified" ||
      !ENS_NAME_REGEX.test(source) ||
      birthdate ||
      isDetectingBirthday
    ) {
      return;
    }
    void detectBirthday(source);
  }, [
    ownershipStatus,
    sourceEnsName,
    birthdate,
    isDetectingBirthday,
    detectBirthday,
  ]);

  const teaserSign = useMemo(
    () => (birthdate ? getZodiacSign(birthdate) : null),
    [birthdate],
  );

  const getProofResultClassName = (result: PermissionProofResult): string => {
    if (result.status === "success" || result.status === "expected_revert") {
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    }
    if (result.status === "unexpected_success") {
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    }
    return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  };

  const ensureSepolia = async (): Promise<void> => {
    await switchChainAsync({ chainId: sepolia.id });
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setLocalError("");

    const normalizedEns = sourceEnsName.trim().toLowerCase();
    if (!ENS_NAME_REGEX.test(normalizedEns)) {
      setLocalError("Please enter a valid ENS name like pamela.eth.");
      return;
    }
    if (!birthdate || Number.isNaN(Date.parse(birthdate))) {
      setLocalError("Please enter a valid birthdate.");
      return;
    }
    if (!readingPreview.readingNamehash) {
      setLocalError("Could not compute readingNamehash.");
      return;
    }
    if (!PAY_ADDRESS || !DEMO_USDC_ADDRESS) {
      setLocalError(
        "Missing NEXT_PUBLIC_ENSTROLOGYP_PAY_ADDRESS or NEXT_PUBLIC_DEMO_USDC_ADDRESS.",
      );
      return;
    }

    setIsPaying(true);
    setApproveTxHash("");
    setPurchaseTxHash("");
    setVisibilityTxHash("");

    try {
      if (!isConnected || !walletAddress) {
        openConnectModal?.();
        throw new Error(
          "Connect a wallet first. Rainbow, MetaMask, Phantom, or WalletConnect all work.",
        );
      }
      if (!walletClient) {
        throw new Error(
          "Wallet is connected but not ready. Open the connect button and try again.",
        );
      }

      setFlowMessage("Switching to Sepolia...");
      await ensureSepolia();

      const connectedWallet = walletAddress as `0x${string}`;

      const normalizedWallet = connectedWallet.toLowerCase() as `0x${string}`;
      const currentIdentityKey = `${normalizedWallet}|${normalizedEns}`;
      const isAlreadyVerified =
        ownershipStatus === "verified" &&
        verifiedIdentityKey === currentIdentityKey;
      if (!isAlreadyVerified) {
        setFlowMessage("Verifying that wallet controls the source name...");
        const verified = await verifyOwnership(normalizedWallet, normalizedEns);
        if (!verified) {
          throw new Error(
            "Ownership verification failed. Use a source ENS/address controlled by this wallet.",
          );
        }
      }

      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(SEPOLIA_RPC),
      });

      const sourceNamehash = namehash(normalizedEns);
      const readingNamehash = readingPreview.readingNamehash as `0x${string}`;

      setFlowMessage("Validating contract addresses...");
      const payCode = await publicClient.getCode({ address: PAY_ADDRESS });
      if (!payCode || payCode === "0x") {
        throw new Error(
          `ENStrologyPay is not deployed at ${PAY_ADDRESS} on Sepolia. Update NEXT_PUBLIC_ENSTROLOGYP_PAY_ADDRESS.`,
        );
      }
      const usdcCode = await publicClient.getCode({
        address: DEMO_USDC_ADDRESS,
      });
      if (!usdcCode || usdcCode === "0x") {
        throw new Error(
          `Demo USDC is not deployed at ${DEMO_USDC_ADDRESS} on Sepolia. Update NEXT_PUBLIC_DEMO_USDC_ADDRESS.`,
        );
      }

      setFlowMessage("Approving 0.01 demo USDC...");
      const approveHash = await walletClient.writeContract({
        account: connectedWallet,
        address: DEMO_USDC_ADDRESS,
        abi: DEMO_USDC_ABI,
        functionName: "approve",
        args: [PAY_ADDRESS, PRICE],
      });
      setApproveTxHash(approveHash);
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      setFlowMessage("Paying ENStrology (purchaseReading)...");
      const purchaseHash = await walletClient.writeContract({
        account: connectedWallet,
        address: PAY_ADDRESS,
        abi: ENSTROLOGY_PAY_ABI,
        functionName: "purchaseReading",
        args: [sourceNamehash, readingNamehash],
      });
      setPurchaseTxHash(purchaseHash);
      await publicClient.waitForTransactionReceipt({ hash: purchaseHash });

      if (visibility === "public") {
        setFlowMessage("Setting visibility to public...");
        const visibilityHash = await walletClient.writeContract({
          account: connectedWallet,
          address: PAY_ADDRESS,
          abi: ENSTROLOGY_PAY_ABI,
          functionName: "setReadingPublished",
          args: [readingNamehash, true],
        });
        setVisibilityTxHash(visibilityHash);
        await publicClient.waitForTransactionReceipt({ hash: visibilityHash });
      }

      setFlowMessage(
        "Payment complete. Generating horoscope and writing ENS text records...",
      );
      const formData = new FormData();
      formData.set("sourceEnsName", normalizedEns);
      formData.set("birthdate", birthdate);
      formData.set("readingNamehash", readingNamehash);
      formData.set("visibility", visibility);

      startDispatchTransition(() => {
        formAction(formData);
      });
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Transaction failed.",
      );
      setFlowMessage("Flow stopped.");
    } finally {
      setIsPaying(false);
    }
  };

  const submitLabel = isBusy ? "Reading the stars..." : "Reveal my ENStrology";

  return (
    <div className="w-full">
      <form
        onSubmit={onSubmit}
        className="rounded-[28px] border border-white/10 bg-[#141022]/80 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8"
      >
        <div className="space-y-2">
          <label
            htmlFor="sourceEnsName"
            className="text-[11px] font-semibold tracking-[0.16em] text-zinc-500 uppercase"
          >
            Your ENS name
          </label>
          <div className="relative">
            <input
              id="sourceEnsName"
              name="sourceEnsName"
              type="text"
              placeholder="pamela.eth"
              required
              value={sourceEnsName}
              onChange={(event) => {
                const nextValue = event.target.value;
                setSourceEnsName(nextValue);
                setBirthdate("");
                setBirthdaySource("");
                const nextKey = `${walletAddress.trim().toLowerCase()}|${nextValue.trim().toLowerCase()}`;
                if (verifiedIdentityKey !== nextKey) {
                  setOwnershipStatus("idle");
                  setOwnershipMessage("");
                }
              }}
              className="w-full rounded-2xl border border-white/10 bg-[#0c0a18] px-4 py-3.5 pr-44 text-base text-white outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
            />
            <div className="absolute inset-y-0 right-3 flex items-center">
              {ownershipStatus === "verified" ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-400">
                  <span aria-hidden="true">✓</span>
                  You control this name
                </p>
              ) : (
                <button
                  type="button"
                  disabled={
                    isBusy || !walletAddress.trim() || !sourceEnsName.trim()
                  }
                  onClick={async () => {
                    await verifyOwnership(
                      walletAddress
                        ? (walletAddress as `0x${string}`)
                        : undefined,
                      sourceEnsName,
                    );
                  }}
                  className="text-xs font-medium text-violet-300 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {ownershipStatus === "verifying" ? "Checking..." : "Verify"}
                </button>
              )}
            </div>
          </div>
          {ownershipStatus === "unverified" ? (
            <p className="text-xs text-rose-400">
              {ownershipMessage || "This wallet does not control that name."}
            </p>
          ) : null}
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-violet-300" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <circle cx="5" cy="7" r="1.4" fill="#E8C56A" />
                  <circle cx="11" cy="5" r="1.4" fill="#E8C56A" />
                  <circle cx="16" cy="9" r="1.4" fill="#E8C56A" />
                  <circle cx="19" cy="15" r="1.4" fill="#E8C56A" />
                  <path
                    d="M5 7L11 5L16 9L19 15"
                    stroke="#C4B5FD"
                    strokeWidth="1.2"
                  />
                </svg>
              </span>
              <div>
                <p className="text-sm font-medium text-white">
                  {birthdate
                    ? `ENS birthday: ${formatBirthdate(birthdate)}`
                    : isDetectingBirthday
                      ? "Detecting ENS birthday..."
                      : "ENS birthday"}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  {birthdate
                    ? birthdaySourceLabel(birthdaySource)
                    : "Verify a name to read its onchain birth date"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void detectBirthday()}
              disabled={isBusy}
              className="shrink-0 text-xs font-medium text-zinc-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Refresh
            </button>
          </div>
          {!birthdate ? (
            <input
              id="birthdate"
              name="birthdate"
              type="date"
              required
              value={birthdate}
              onChange={(event) => setBirthdate(event.target.value)}
              className="mt-3 w-full rounded-xl border border-white/10 bg-[#0c0a18] px-3 py-2 text-sm text-zinc-300 outline-none focus:border-violet-400/50"
            />
          ) : (
            <input type="hidden" name="birthdate" value={birthdate} />
          )}
        </div>

        {teaserSign ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-dashed border-white/15 px-4 py-4">
            <div>
              <p className="font-display text-lg text-[#E8C56A]">
                Your name is a {teaserSign}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Free teaser — the full reading awaits
              </p>
            </div>
            <span className="text-[#E8C56A]" aria-hidden="true">
              ✦
            </span>
          </div>
        ) : null}

        <input
          type="hidden"
          name="readingNamehash"
          value={readingPreview.readingNamehash}
          readOnly
        />

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xl font-semibold tracking-tight text-white">
              0.01 USDC
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Demo token · Sepolia testnet
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={visibility === "public"}
                onChange={(event) =>
                  setVisibility(event.target.checked ? "public" : "private")
                }
                className="h-4 w-4 rounded border-white/20 bg-transparent"
              />
              Share on Cosmic Feed
            </label>
          </div>
          <button
            type="submit"
            disabled={isBusy}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#C4B5FD] px-6 py-3 text-sm font-semibold text-[#1B1233] transition hover:bg-[#d4c8ff] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span aria-hidden="true" className="mr-2">
              ✦
            </span>
            {submitLabel}
          </button>
        </div>
      </form>

      <p className="mt-5 text-center text-sm text-zinc-500">
        Entertainment only — not advice. Facts marked as verified come from real
        onchain data.
      </p>

      {flowMessage && isBusy ? (
        <p className="mt-3 text-center text-sm text-violet-200">
          {flowMessage}
        </p>
      ) : null}

      {localError ? (
        <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {localError}
        </div>
      ) : null}

      {approveTxHash || purchaseTxHash || visibilityTxHash ? (
        <div className="mt-4 space-y-1 rounded-2xl border border-white/10 bg-[#141022]/80 p-4 text-xs text-zinc-400">
          <p className="text-sm font-medium text-white">Payment transactions</p>
          {approveTxHash ? (
            <p className="break-all">approve: {approveTxHash}</p>
          ) : null}
          {purchaseTxHash ? (
            <p className="break-all">purchaseReading: {purchaseTxHash}</p>
          ) : null}
          {visibilityTxHash ? (
            <p className="break-all">setReadingPublished: {visibilityTxHash}</p>
          ) : null}
        </div>
      ) : null}

      {state.message ? (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
            state.status === "error"
              ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      {state.result ? (
        <div className="mt-6 space-y-3 rounded-[28px] border border-white/10 bg-[#141022]/80 p-6 text-sm">
          <p className="font-display text-2xl text-white">
            {state.result.horoscope.sign} — {state.result.horoscope.title}
          </p>
          <p className="text-zinc-400">
            {state.result.sourceEnsName}
            {state.result.birthdate
              ? ` · ${formatBirthdate(state.result.birthdate)}`
              : ""}
          </p>
          {state.result.readingEnsName ? (
            <a
              href={`https://explorer.ens.dev/${state.result.readingEnsName}`}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-violet-300 underline"
            >
              {state.result.readingEnsName}
            </a>
          ) : null}
          <p className="whitespace-pre-wrap leading-7 text-zinc-200">
            {state.result.horoscope.reading}
          </p>
          <p className="text-zinc-500">
            Lucky color {state.result.horoscope.luckyColor} · Lucky number{" "}
            {state.result.horoscope.luckyNumber}
          </p>
          <ul className="space-y-1 text-xs text-zinc-500">
            {Object.entries(state.result.transactions).map(([key, hash]) => (
              <li key={key} className="break-all">
                {key}: {hash}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <details className="mt-8 rounded-2xl border border-white/10 bg-[#141022]/60 p-4 text-sm text-zinc-300">
        <summary className="cursor-pointer font-medium text-zinc-200">
          Permission proof (ENSv2)
        </summary>
        <p className="mt-2 text-xs text-zinc-500">
          Judge demo: prove the Oracle cannot write forbidden fields, then
          revoke permission and prove writes are blocked.
        </p>
        <div className="mt-3 space-y-1">
          <label
            htmlFor="permissionNodeName"
            className="text-xs font-medium text-zinc-400"
          >
            Permission node for revoke test
          </label>
          <input
            id="permissionNodeName"
            type="text"
            value={permissionNodeName}
            onChange={(event) => setPermissionNodeName(event.target.value)}
            placeholder="oracle.enstrology.eth"
            className="w-full rounded-xl border border-white/10 bg-[#0c0a18] px-3 py-2 text-sm text-white outline-none focus:border-violet-400/50"
          />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            disabled={isBusy || !sourceEnsName.trim()}
            onClick={() =>
              startProofTransition(async () => {
                setFlowMessage("Attempting forbidden Oracle write...");
                const result = await forbiddenWriteAction({
                  targetEnsName: sourceEnsName.trim().toLowerCase(),
                });
                setForbiddenResult(result);
                setFlowMessage(result.message);
              })
            }
            className="rounded-xl border border-white/15 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            1) Forbidden Write
          </button>
          <button
            type="button"
            disabled={isBusy || !permissionNodeName.trim()}
            onClick={() =>
              startProofTransition(async () => {
                setFlowMessage("Revoking Oracle roles...");
                const result = await revokeOracleAction({
                  permissionEnsName: permissionNodeName.trim().toLowerCase(),
                });
                setRevokeResult(result);
                setFlowMessage(result.message);
              })
            }
            className="rounded-xl border border-white/15 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            2) Revoke Oracle
          </button>
          <button
            type="button"
            disabled={isBusy || !permissionNodeName.trim()}
            onClick={() =>
              startProofTransition(async () => {
                setFlowMessage("Attempting post-revoke Oracle write...");
                const result = await retryOracleWriteAction({
                  targetEnsName: permissionNodeName.trim().toLowerCase(),
                });
                setRetryResult(result);
                setFlowMessage(result.message);
              })
            }
            className="rounded-xl border border-white/15 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            3) Retry Write
          </button>
        </div>
        {forbiddenResult ? (
          <div
            className={`mt-3 rounded-xl border px-3 py-2 text-xs ${getProofResultClassName(forbiddenResult)}`}
          >
            <p className="font-medium">Forbidden Write Result</p>
            <p>{forbiddenResult.message}</p>
            {forbiddenResult.txHash ? (
              <p>tx: {forbiddenResult.txHash}</p>
            ) : null}
          </div>
        ) : null}
        {revokeResult ? (
          <div
            className={`mt-3 rounded-xl border px-3 py-2 text-xs ${getProofResultClassName(revokeResult)}`}
          >
            <p className="font-medium">Revoke Result</p>
            <p>{revokeResult.message}</p>
            {revokeResult.txHash ? <p>tx: {revokeResult.txHash}</p> : null}
          </div>
        ) : null}
        {retryResult ? (
          <div
            className={`mt-3 rounded-xl border px-3 py-2 text-xs ${getProofResultClassName(retryResult)}`}
          >
            <p className="font-medium">Post-Revoke Write Result</p>
            <p>{retryResult.message}</p>
            {retryResult.txHash ? <p>tx: {retryResult.txHash}</p> : null}
          </div>
        ) : null}
      </details>
    </div>
  );
}
