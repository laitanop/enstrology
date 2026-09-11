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
import { useRouter } from "next/navigation";
import { createPublicClient, http, namehash } from "viem";
import { sepolia } from "viem/chains";
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";
import type { FeedCard } from "@/lib/feed";
import { friendlyFlowError } from "@/lib/flow-error";
import { announceNewReading } from "./home-feed-list";
import ReadingProgressModal, {
  type ReadingProgressStatus,
  type ReadingProgressStep,
} from "./reading-progress-modal";

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

function ensResolverExplorerUrl(ensName: string): string {
  return `https://explorer.ens.dev/${encodeURIComponent(ensName.trim().toLowerCase())}/resolver`;
}

function ProofVerifyLinks({
  ensName,
  txHash,
}: {
  ensName?: string;
  txHash?: string;
}) {
  const name = ensName?.trim().toLowerCase();
  if (!name && !txHash) {
    return null;
  }

  return (
    <p className="mt-2 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4">
      {name ? (
        <a
          href={ensResolverExplorerUrl(name)}
          target="_blank"
          rel="noreferrer"
          className="text-violet-300 underline underline-offset-2"
        >
          Verify on ENS explorer
        </a>
      ) : null}
      {txHash ? (
        <a
          href={`https://sepolia.etherscan.io/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="text-violet-300 underline underline-offset-2"
        >
          Sepolia transaction
        </a>
      ) : null}
    </p>
  );
}

function proofPassLabel(
  result: PermissionProofResult,
  kind: "forbid" | "revoke" | "retry",
): string {
  if (result.status === "expected_revert") {
    return "Pass";
  }
  if (result.status === "success" && kind === "revoke") {
    return "Pass";
  }
  if (result.status === "unexpected_success") {
    return "Fail";
  }
  return "Error";
}

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
  const { address, isConnected, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const walletAddress = address || "";
  const previousAddressRef = useRef<string>("");
  const [sourceEnsName, setSourceEnsName] = useState<string>("");
  const [birthdate, setBirthdate] = useState<string>("");
  const [birthdaySource, setBirthdaySource] = useState<string>("");
  const [localError, setLocalError] = useState<string>("");
  const [flowMessage, setFlowMessage] = useState<string>(
    "Connect wallet to start.",
  );
  const [approveTxHash, setApproveTxHash] = useState<string>("");
  const [purchaseTxHash, setPurchaseTxHash] = useState<string>("");
  const [visibilityTxHash, setVisibilityTxHash] = useState<string>("");
  const [isPaying, setIsPaying] = useState<boolean>(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressStatus, setProgressStatus] =
    useState<ReadingProgressStatus>("running");
  const [progressStep, setProgressStep] =
    useState<ReadingProgressStep>("prepare");
  const [awaitingOracle, setAwaitingOracle] = useState(false);
  const router = useRouter();
  const [isDetectingEns, setIsDetectingEns] = useState<boolean>(false);
  const [isDetectingBirthday, setIsDetectingBirthday] =
    useState<boolean>(false);
  const [ownershipStatus, setOwnershipStatus] =
    useState<OwnershipStatus>("idle");
  const [ownershipMessage, setOwnershipMessage] = useState<string>("");
  const [verifiedIdentityKey, setVerifiedIdentityKey] = useState<string>("");
  const permissionNodeName = "oracle.enstrology.eth";
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

  const onSepolia = chainId === sepolia.id;
  const isBusy =
    isPending ||
    isPaying ||
    isDispatchPending ||
    awaitingOracle ||
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
    setIsDetectingEns(true);

    void detectPrimaryEnsFromWallet(walletAddress)
      .then((detectedEns) => {
        if (cancelled) {
          return;
        }

        if (detectedEns) {
          setSourceEnsName(detectedEns);
          setFlowMessage(
            `ENS detected: ${detectedEns}. Verifying ownership...`,
          );
        } else {
          setFlowMessage(
            "No primary ENS name found for this wallet. Type your name and tap Verify.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsDetectingEns(false);
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
    setProgressOpen(true);
    setProgressStatus("running");
    setProgressStep("prepare");
    setAwaitingOracle(false);

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
      setProgressStep("prepare");
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
      setProgressStep("approve");
      const approveHash = await walletClient.writeContract({
        account: connectedWallet,
        address: DEMO_USDC_ADDRESS,
        abi: DEMO_USDC_ABI,
        functionName: "approve",
        args: [PAY_ADDRESS, PRICE],
      });
      setApproveTxHash(approveHash);
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      setFlowMessage("Confirm the payment in your wallet...");
      setProgressStep("pay");
      const purchaseHash = await walletClient.writeContract({
        account: connectedWallet,
        address: PAY_ADDRESS,
        abi: ENSTROLOGY_PAY_ABI,
        functionName: "purchaseReading",
        args: [sourceNamehash, readingNamehash],
      });
      setPurchaseTxHash(purchaseHash);
      await publicClient.waitForTransactionReceipt({ hash: purchaseHash });

      setFlowMessage("Sharing reading on Cosmic Feed...");
      setProgressStep("publish");
      const visibilityHash = await walletClient.writeContract({
        account: connectedWallet,
        address: PAY_ADDRESS,
        abi: ENSTROLOGY_PAY_ABI,
        functionName: "setReadingPublished",
        args: [readingNamehash, true],
      });
      setVisibilityTxHash(visibilityHash);
      await publicClient.waitForTransactionReceipt({ hash: visibilityHash });

      setFlowMessage("Payment landed. The Oracle is writing your horoscope...");
      setProgressStep("create");
      const formData = new FormData();
      formData.set("sourceEnsName", normalizedEns);
      formData.set("birthdate", birthdate);
      formData.set("readingNamehash", readingNamehash);
      formData.set("visibility", "public");

      setAwaitingOracle(true);
      startDispatchTransition(() => {
        formAction(formData);
      });
    } catch (error) {
      const nextError =
        error instanceof Error ? error.message : "Transaction failed.";
      setLocalError(nextError);
      setFlowMessage("Flow stopped.");
      setProgressStatus("error");
    } finally {
      setIsPaying(false);
    }
  };

  useEffect(() => {
    if (!awaitingOracle || isPending || isDispatchPending) {
      return;
    }
    if (state.status === "success") {
      setProgressStatus("success");
      setFlowMessage(state.message || "Horoscope written onchain.");
      setAwaitingOracle(false);
      return;
    }
    if (state.status === "error") {
      setProgressStatus("error");
      setLocalError(state.message);
      setFlowMessage(state.message || "Horoscope creation failed.");
      setAwaitingOracle(false);
    }
  }, [awaitingOracle, isDispatchPending, isPending, state]);

  const closeProgressModal = useCallback(() => {
    if (progressStatus === "success" && state.result) {
      const now = Date.now();
      const card: FeedCard = {
        readingNamehash: state.result.readingNamehash as `0x${string}`,
        readingEnsName: state.result.readingEnsName || readingPreview.readingEnsName,
        sourceEnsName: state.result.sourceEnsName,
        birthdate: state.result.birthdate,
        buyer: (walletAddress as `0x${string}`) || "0x0000000000000000000000000000000000000000",
        purchasedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
        paymentTxHash: purchaseTxHash
          ? (purchaseTxHash as `0x${string}`)
          : null,
        sign: state.result.horoscope.sign,
        title: state.result.horoscope.title,
        reading: state.result.horoscope.reading,
        luckyColor: state.result.horoscope.luckyColor,
        luckyNumber: state.result.horoscope.luckyNumber,
      };
      announceNewReading(card);
      router.refresh();
      window.requestAnimationFrame(() => {
        document.getElementById("feed")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
    setProgressOpen(false);
  }, [
    progressStatus,
    purchaseTxHash,
    readingPreview.readingEnsName,
    router,
    state.result,
    walletAddress,
  ]);

  const submitLabel = isBusy ? "Reading the stars..." : "Reveal my ENStrology";

  const renderENSName = () => {
    if (sourceEnsName)
      return (
        <span className="text-white" style={{ fontSize: "14px" }}>
          {sourceEnsName}
        </span>
      );
    if (!isDetectingEns && walletAddress && !sourceEnsName.trim()) {
      return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-6)}`;
    }
    if (ownershipStatus === "verifying") {
      return "Checking...";
    }
    return "Connect your wallet ";
  };

  return (
    <div className="w-full">
      <form
        onSubmit={onSubmit}
        className="rounded-[28px] border border-white/10 bg-[#141022]/80 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8"
      >
        <div className="space-y-3">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-zinc-500">ENS</span>
            <span className="font-medium text-white">{renderENSName()}</span>
            {ownershipStatus === "verified" ? (
              <span className="text-emerald-400">✓ yours</span>
            ) : null}
          </p>
          {isDetectingEns && onSepolia ? (
            <p className="text-xs text-zinc-500">Looking up ENS on Sepolia...</p>
          ) : null}
          {onSepolia &&
          !isDetectingEns &&
          walletAddress &&
          !sourceEnsName.trim() ? (
            <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-3 py-3 text-xs leading-5 text-amber-100/90">
              <p>
                No ENSv2 name on Sepolia for this wallet. Mainnet names do not
                work in this demo.
              </p>
              <a
                href="https://explorer.ens.dev/"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex min-h-11 items-center font-medium text-white underline underline-offset-2"
              >
                Register a Sepolia name on ENS Explorer
              </a>
            </div>
          ) : null}
          {ownershipStatus === "unverified" ? (
            <p className="text-xs text-rose-400">
              {ownershipMessage || "This wallet does not control that name."}
            </p>
          ) : null}
          {birthdate ? (
            <p className="text-sm text-zinc-300">
              Birthday {formatBirthdate(birthdate)}
            </p>
          ) : null}
          {teaserSign ? (
            <p className="font-display text-lg text-[#E8C56A]">
              Your name is a {teaserSign}
            </p>
          ) : null}
        </div>

        <input
          type="hidden"
          name="readingNamehash"
          value={readingPreview.readingNamehash}
          readOnly
        />

        <button
          type="submit"
          disabled={
            isBusy ||
            isDetectingEns ||
            !sourceEnsName.trim() ||
            (Boolean(walletAddress) && !onSepolia)
          }
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#C4B5FD] px-6 py-3 text-sm font-semibold text-[#1B1233] transition hover:bg-[#d4c8ff] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitLabel} · 0.01 USDC
        </button>
      </form>

      {localError && !progressOpen ? (
        <div className="mt-4 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {friendlyFlowError(localError)}
        </div>
      ) : null}

      <ReadingProgressModal
        open={progressOpen}
        status={progressStatus}
        step={progressStep}
        message={flowMessage}
        purchaseTxHash={purchaseTxHash}
        approveTxHash={approveTxHash}
        publishTxHash={visibilityTxHash}
        errorMessage={localError}
        onClose={closeProgressModal}
      />

      <details className="mt-8 rounded-2xl border border-white/10 bg-[#141022]/60 p-4 text-sm text-zinc-300">
        <summary className="cursor-pointer font-medium text-zinc-200">
          Judge demo: Oracle permissions
        </summary>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          The Oracle wallet may write horoscope records, and nothing else. Click
          the three steps in order.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Target node: {permissionNodeName}. Revoke is one-shot until roles are
          granted again.
        </p>

        <ol className="mt-4 space-y-4">
          <li className="rounded-xl border border-white/10 bg-[#0c0a18]/80 p-3">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
              Step 1
            </p>
            <p className="mt-1 font-medium text-zinc-100">
              Try a forbidden field
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Ask the Oracle to set{" "}
              <span className="text-zinc-300">source.name</span> on{" "}
              {sourceEnsName.trim() || "your ENS"}. It should not have that
              permission.
            </p>
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
              className="mt-3 min-h-11 w-full rounded-xl border border-white/15 px-3 text-sm font-medium text-zinc-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Try forbidden write
            </button>
            {forbiddenResult ? (
              <div
                className={`mt-3 rounded-xl border px-3 py-2 text-xs ${getProofResultClassName(forbiddenResult)}`}
              >
                <p className="font-medium">
                  {proofPassLabel(forbiddenResult, "forbid")}
                </p>
                <p className="mt-1">{forbiddenResult.message}</p>
                <ProofVerifyLinks
                  ensName={forbiddenResult.targetEnsName || sourceEnsName}
                  txHash={forbiddenResult.txHash}
                />
              </div>
            ) : null}
          </li>

          <li className="rounded-xl border border-white/10 bg-[#0c0a18]/80 p-3">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
              Step 2
            </p>
            <p className="mt-1 font-medium text-zinc-100">Fire the Oracle</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Revoke its write roles on {permissionNodeName}. After this, even
              allowed horoscope keys should fail.
            </p>
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
              className="mt-3 min-h-11 w-full rounded-xl border border-white/15 px-3 text-sm font-medium text-zinc-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Revoke Oracle permission
            </button>
            {revokeResult ? (
              <div
                className={`mt-3 rounded-xl border px-3 py-2 text-xs ${getProofResultClassName(revokeResult)}`}
              >
                <p className="font-medium">
                  {proofPassLabel(revokeResult, "revoke")}
                </p>
                <p className="mt-1">{revokeResult.message}</p>
                <ProofVerifyLinks
                  ensName={revokeResult.targetEnsName || permissionNodeName}
                  txHash={revokeResult.txHash}
                />
              </div>
            ) : null}
          </li>

          <li className="rounded-xl border border-white/10 bg-[#0c0a18]/80 p-3">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
              Step 3
            </p>
            <p className="mt-1 font-medium text-zinc-100">
              Try a normal write anyway
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Same Oracle, now without roles. A horoscope text write should
              revert.
            </p>
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
              className="mt-3 min-h-11 w-full rounded-xl border border-white/15 px-3 text-sm font-medium text-zinc-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Retry write
            </button>
            {retryResult ? (
              <div
                className={`mt-3 rounded-xl border px-3 py-2 text-xs ${getProofResultClassName(retryResult)}`}
              >
                <p className="font-medium">
                  {proofPassLabel(retryResult, "retry")}
                </p>
                <p className="mt-1">{retryResult.message}</p>
                <ProofVerifyLinks
                  ensName={retryResult.targetEnsName || permissionNodeName}
                  txHash={retryResult.txHash}
                />
              </div>
            ) : null}
          </li>
        </ol>
      </details>
    </div>
  );
}
