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
import { createPublicClient, http, namehash, zeroAddress } from "viem";
import { sepolia } from "viem/chains";
import { useAccount, useWalletClient } from "wagmi";
import {
  resolveDemoUsdcAddress,
  resolveEnstrologyPayAddress,
} from "@/lib/contracts";
import { switchWalletChain, useWalletNetwork } from "@/lib/wallet-network";
import type { FeedCard } from "@/lib/feed";
import { friendlyFlowError } from "@/lib/flow-error";
import { announceNewReading } from "./home-feed-list";
import JudgeDemoModal, {
  ProofVerifyLinks,
  type JudgeProofKind,
} from "./judge-demo-modal";
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
const PAY_ADDRESS = resolveEnstrologyPayAddress(
  process.env.NEXT_PUBLIC_ENSTROLOGYP_PAY_ADDRESS,
  process.env.ENSTROLOGYP_PAY_ADDRESS,
);
const DEMO_USDC_ADDRESS = resolveDemoUsdcAddress(
  process.env.NEXT_PUBLIC_DEMO_USDC_ADDRESS,
);
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
    name: "readings",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "readingNamehash", type: "bytes32" }],
    outputs: [
      { name: "buyer", type: "address" },
      { name: "sourceNamehash", type: "bytes32" },
      { name: "purchasedAt", type: "uint256" },
      { name: "published", type: "bool" },
    ],
  },
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

function isProofPass(
  result: PermissionProofResult | null,
  kind: "forbid" | "revoke" | "retry",
): boolean {
  if (!result) return false;
  if (result.status === "expected_revert") return true;
  return result.status === "success" && kind === "revoke";
}

function proofPassLabel(
  result: PermissionProofResult,
  kind: "forbid" | "revoke" | "retry",
): string {
  if (isProofPass(result, kind)) {
    return "Pass";
  }
  if (result.status === "unexpected_success") {
    return "Fail";
  }
  return "Error";
}

function proofResultClassName(result: PermissionProofResult): string {
  if (result.status === "success" || result.status === "expected_revert") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }
  if (result.status === "unexpected_success") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
  return "border-rose-500/30 bg-rose-500/10 text-rose-200";
}

function JudgeDemoPanel({
  permissionNodeName,
  forbiddenTargetName,
  isBusy,
  isProofPending,
  forbiddenResult,
  revokeResult,
  retryResult,
  onForbidden,
  onRevoke,
  onRetry,
}: {
  permissionNodeName: string;
  forbiddenTargetName: string;
  isBusy: boolean;
  isProofPending: boolean;
  forbiddenResult: PermissionProofResult | null;
  revokeResult: PermissionProofResult | null;
  retryResult: PermissionProofResult | null;
  onForbidden: () => void;
  onRevoke: () => void;
  onRetry: () => void;
}) {
  const step1Done = Boolean(forbiddenResult);
  const step2Done = Boolean(revokeResult);
  const step1Pass = isProofPass(forbiddenResult, "forbid");
  const step2Pass = isProofPass(revokeResult, "revoke");
  const step3Pass = isProofPass(retryResult, "retry");
  const activeStep = step1Done ? (step2Done ? 3 : 2) : 1;
  const steps = [
    {
      n: 1,
      title: "Prove a bad write fails",
      expect: "Should fail",
      copy: `Ask the Oracle to write source.name on ${forbiddenTargetName}. That is someone else’s name.`,
      action: "Run step 1",
      disabled: isBusy,
      onClick: onForbidden,
      result: forbiddenResult,
      kind: "forbid" as const,
      ensName: forbiddenResult?.targetEnsName || forbiddenTargetName,
    },
    {
      n: 2,
      title: "Revoke the Oracle",
      expect: "Should succeed",
      copy: `Remove the Oracle’s write roles on ${permissionNodeName}.`,
      action: "Run step 2",
      disabled: isBusy || !step1Done,
      onClick: onRevoke,
      result: revokeResult,
      kind: "revoke" as const,
      ensName: revokeResult?.targetEnsName || permissionNodeName,
    },
    {
      n: 3,
      title: "Prove a normal write now fails",
      expect: "Should fail",
      copy: "Same Oracle, no roles left. A horoscope write must revert.",
      action: "Run step 3",
      disabled: isBusy || !step2Done,
      onClick: onRetry,
      result: retryResult,
      kind: "retry" as const,
      ensName: retryResult?.targetEnsName || permissionNodeName,
    },
  ];

  return (
    <section className="rounded-[28px] border border-[#E8C56A]/25 bg-[#141022]/80 p-5">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-[#E8C56A] uppercase">
        For judges
      </p>
      <h2 className="mt-1 text-lg font-semibold text-white">
        Oracle permission demo
      </h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        Three clicks. 1 and 3 should fail. 2 should succeed.
      </p>
      <div className="mt-4 flex gap-2">
        {[1, 2, 3].map((n) => {
          const done =
            (n === 1 && step1Pass) ||
            (n === 2 && step2Pass) ||
            (n === 3 && step3Pass);
          const current = n === activeStep;
          return (
            <div
              key={n}
              className={`flex h-9 flex-1 items-center justify-center rounded-full text-sm font-semibold ${
                done
                  ? "bg-emerald-500/20 text-emerald-200"
                  : current
                    ? "bg-[#C4B5FD] text-[#1B1233]"
                    : "bg-white/5 text-zinc-500"
              }`}
            >
              {done ? `✓ ${n}` : n}
            </div>
          );
        })}
      </div>
      <ol className="mt-4 space-y-3">
        {steps.map((step) => {
          const locked = step.n > activeStep;
          return (
            <li
              key={step.n}
              className={`rounded-2xl border p-4 ${
                locked
                  ? "border-white/5 bg-[#0c0a18]/40 opacity-55"
                  : "border-white/10 bg-[#0c0a18]/80"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-white">
                  {step.n}. {step.title}
                </p>
                <span className="shrink-0 rounded-full bg-white/5 px-2 py-1 text-[11px] font-medium text-zinc-400">
                  {step.expect}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{step.copy}</p>
              <button
                type="button"
                disabled={step.disabled || locked}
                onClick={step.onClick}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-[#C4B5FD] px-4 text-sm font-semibold text-[#1B1233] transition hover:bg-[#d4c8ff] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-500"
              >
                {isProofPending && !locked && step.n === activeStep
                  ? "Running…"
                  : step.action}
              </button>
              {step.result ? (
                <div
                  className={`mt-3 rounded-2xl border px-3 py-3 text-sm ${proofResultClassName(step.result)}`}
                >
                  <p className="text-base font-semibold">
                    {proofPassLabel(step.result, step.kind)}
                  </p>
                  <p className="mt-1 text-sm leading-6">
                    {friendlyFlowError(step.result.message)}
                  </p>
                  <ProofVerifyLinks
                    ensName={step.ensName}
                    txHash={step.result.txHash}
                    kind={step.kind}
                    result={step.result}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
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
  const { address, isConnected } = useAccount();
  const { chainId } = useWalletNetwork();
  const { data: walletClient } = useWalletClient();
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
  const forbiddenTargetName = "esther.eth";
  const [forbiddenResult, setForbiddenResult] =
    useState<PermissionProofResult | null>(null);
  const [revokeResult, setRevokeResult] =
    useState<PermissionProofResult | null>(null);
  const [retryResult, setRetryResult] = useState<PermissionProofResult | null>(
    null,
  );
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [proofKind, setProofKind] = useState<JudgeProofKind>("forbid");
  const [isProofPending, startProofTransition] = useTransition();
  const [isDispatchPending, startDispatchTransition] = useTransition();
  const [panel, setPanel] = useState<"reading" | "judge">("reading");
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
    if (window.location.hash === "#judge") {
      setPanel("judge");
    }
  }, []);

  const openPanel = (next: "reading" | "judge") => {
    setPanel(next);
    if (next === "judge") {
      window.history.replaceState(null, "", "#judge");
      return;
    }
    if (window.location.hash === "#judge") {
      window.history.replaceState(null, "", window.location.pathname);
    }
  };

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

  const ensureSepolia = async (): Promise<void> => {
    await switchWalletChain(sepolia.id);
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

      const existingReading = await publicClient.readContract({
        address: PAY_ADDRESS,
        abi: ENSTROLOGY_PAY_ABI,
        functionName: "readings",
        args: [readingNamehash],
      });
      const [buyer, , purchasedAt, published] = existingReading;
      const alreadyBought =
        purchasedAt > BigInt(0) &&
        buyer.toLowerCase() === connectedWallet.toLowerCase();

      if (purchasedAt > BigInt(0) && buyer.toLowerCase() !== connectedWallet.toLowerCase() && buyer !== zeroAddress) {
        throw new Error(
          "This reading was already bought with another wallet. Use a different ENS or birthday.",
        );
      }

      if (alreadyBought) {
        setFlowMessage("Payment already landed. Asking the Oracle to write...");
        if (!published) {
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
        }
      } else {
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
      }

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
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-[#141022]/70 p-1">
        <button
          type="button"
          onClick={() => openPanel("reading")}
          className={`min-h-11 rounded-xl text-sm font-semibold transition ${
            panel === "reading"
              ? "bg-[#C4B5FD] text-[#1B1233]"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Reading
        </button>
        <button
          type="button"
          onClick={() => openPanel("judge")}
          className={`min-h-11 rounded-xl text-sm font-semibold transition ${
            panel === "judge"
              ? "bg-[#C4B5FD] text-[#1B1233]"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Judge demo
        </button>
      </div>

      {panel === "reading" ? (
      <>
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
      </>
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

      {panel === "judge" ? (
        <JudgeDemoPanel
          permissionNodeName={permissionNodeName}
          forbiddenTargetName={forbiddenTargetName}
          isBusy={isBusy}
          isProofPending={isProofPending}
          forbiddenResult={forbiddenResult}
          revokeResult={revokeResult}
          retryResult={retryResult}
          onForbidden={() => {
            setForbiddenResult(null);
            setProofKind("forbid");
            setProofModalOpen(true);
            startProofTransition(async () => {
              const result = await forbiddenWriteAction({
                targetEnsName: forbiddenTargetName,
              });
              setForbiddenResult(result);
            });
          }}
          onRevoke={() => {
            setRevokeResult(null);
            setProofKind("revoke");
            setProofModalOpen(true);
            startProofTransition(async () => {
              const result = await revokeOracleAction({
                permissionEnsName: permissionNodeName,
              });
              setRevokeResult(result);
            });
          }}
          onRetry={() => {
            setRetryResult(null);
            setProofKind("retry");
            setProofModalOpen(true);
            startProofTransition(async () => {
              const result = await retryOracleWriteAction({
                targetEnsName: permissionNodeName,
              });
              setRetryResult(result);
            });
          }}
        />
      ) : null}

      <JudgeDemoModal
        open={proofModalOpen}
        running={isProofPending}
        kind={proofKind}
        result={
          proofKind === "forbid"
            ? forbiddenResult
            : proofKind === "revoke"
              ? revokeResult
              : retryResult
        }
        onClose={() => setProofModalOpen(false)}
      />
    </div>
  );
}
