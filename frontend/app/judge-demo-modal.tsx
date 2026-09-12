"use client";

import { useEffect, useId, useRef } from "react";
import { friendlyFlowError } from "@/lib/flow-error";
import OracleSpinner from "./oracle-spinner";
import type { PermissionProofResult } from "./create-reading-form";

export type JudgeProofKind = "forbid" | "revoke" | "retry";

export function ensResolverExplorerUrl(ensName: string): string {
  return `https://explorer.ens.dev/${encodeURIComponent(ensName.trim().toLowerCase())}/resolver`;
}

export function verifyHint(
  kind: JudgeProofKind,
  result: PermissionProofResult,
): string {
  if (kind === "revoke" && result.status === "success") {
    return "Role changes do not show in ENS History. Open the Sepolia transaction — that is the revoke. History will still list old text writes.";
  }
  if (
    (kind === "retry" || kind === "forbid") &&
    result.status === "expected_revert"
  ) {
    return "A blocked write never lands, so History will not get a new line. Proof: no new horoscope.revokeTest from today.";
  }
  if (result.status === "unexpected_success") {
    return "This write did land. In History, look for a new set text record from today.";
  }
  return "Use the links below. History only lists successful text writes.";
}

export function ProofVerifyLinks({
  ensName,
  txHash,
  kind,
  result,
}: {
  ensName?: string;
  txHash?: string;
  kind?: JudgeProofKind;
  result?: PermissionProofResult | null;
}) {
  const name = ensName?.trim().toLowerCase();
  if (!name && !txHash) {
    return null;
  }

  const hint = kind && result ? verifyHint(kind, result) : null;
  const txLabel =
    kind === "revoke" ? "Open revoke tx on Etherscan" : "Open write tx on Etherscan";

  return (
    <div className="mt-2 space-y-2">
      {hint ? (
        <p className="text-xs leading-5 text-zinc-400">{hint}</p>
      ) : null}
      <p className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4">
        {name ? (
          <a
            href={ensResolverExplorerUrl(name)}
            target="_blank"
            rel="noreferrer"
            className="text-violet-300 underline underline-offset-2"
          >
            Open resolver History
          </a>
        ) : null}
        {txHash ? (
          <a
            href={`https://sepolia.etherscan.io/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-violet-300 underline underline-offset-2"
          >
            {txLabel}
          </a>
        ) : result?.status === "expected_revert" ? (
          <span className="text-zinc-500">No transaction — the write never sent</span>
        ) : null}
      </p>
    </div>
  );
}

const RUNNING_COPY: Record<JudgeProofKind, { title: string; line: string }> = {
  forbid: {
    title: "Trying a sneaky write",
    line: "One second… I’m just going to set source.name on someone else’s ENS. Totally allowed. Definitely.",
  },
  revoke: {
    title: "Cutting my own keys",
    line: "Fine. Revoking my write roles on oracle.enstrology.eth. I can take a hint.",
  },
  retry: {
    title: "Trying a normal write anyway",
    line: "Okay, a polite horoscope write this time. Surely I still have permission…",
  },
};

function resultCopy(
  kind: JudgeProofKind,
  result: PermissionProofResult,
): { title: string; line: string } {
  if (kind === "forbid" && result.status === "expected_revert") {
    return {
      title: "The chain said no",
      line: "I could not write source.name. I do not have permission — and honestly, that is the whole point.",
    };
  }
  if (kind === "forbid" && result.status === "unexpected_success") {
    return {
      title: "Wait. That landed?",
      line: "That write went through. The Oracle boundary did not hold on this name.",
    };
  }
  if (kind === "revoke" && result.status === "success") {
    return {
      title: "Roles revoked",
      line: "I just fired myself. Horoscope keys are gone until someone grants them again.",
    };
  }
  if (kind === "revoke") {
    return {
      title: "Could not hand in my keys",
      line: "The resolver would not let me revoke that permission. Close this and try step 2 again.",
    };
  }
  if (kind === "retry" && result.status === "expected_revert") {
    return {
      title: "Blocked again",
      line: "No roles, no horoscope. I tried, the resolver laughed, we move on.",
    };
  }
  if (kind === "retry" && result.status === "unexpected_success") {
    return {
      title: "I still have the keys?",
      line: "That write should have failed after revoke. Something is still granted.",
    };
  }
  return {
    title: "That did not go as planned",
    line: result.message,
  };
}

type JudgeDemoModalProps = {
  open: boolean;
  running: boolean;
  kind: JudgeProofKind;
  result: PermissionProofResult | null;
  onClose: () => void;
};

export default function JudgeDemoModal({
  open,
  running,
  kind,
  result,
  onClose,
}: JudgeDemoModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const canClose = !running && Boolean(result);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !canClose) {
      return;
    }
    closeRef.current?.focus();
  }, [open, canClose]);

  useEffect(() => {
    if (!open || !canClose) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, canClose, onClose]);

  if (!open) {
    return null;
  }

  const copy = running || !result ? RUNNING_COPY[kind] : resultCopy(kind, result);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-busy={running}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#141022] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)] sm:p-7">
        <div className="flex flex-col items-center text-center">
          {running || !result ? (
            <OracleSpinner className="h-28 w-auto" />
          ) : result.status === "expected_revert" ||
            (result.status === "success" && kind === "revoke") ? (
            <span
              className="flex size-16 items-center justify-center rounded-full bg-emerald-500/15 text-2xl text-emerald-300"
              aria-hidden
            >
              ✓
            </span>
          ) : (
            <span
              className="flex size-16 items-center justify-center rounded-full bg-amber-500/15 text-2xl text-amber-200"
              aria-hidden
            >
              !
            </span>
          )}
          <h2 id={titleId} className="font-display mt-4 text-2xl text-white">
            {copy.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{copy.line}</p>
          {result && !running ? (
            <div className="mt-4 w-full rounded-2xl border border-white/10 bg-[#0c0a18]/80 px-4 py-3 text-left text-sm text-zinc-300">
              <p className="text-sm leading-6">
                {friendlyFlowError(result.message)}
              </p>
              <ProofVerifyLinks
                ensName={result.targetEnsName}
                txHash={result.txHash}
                kind={kind}
                result={result}
              />
            </div>
          ) : (
            <p className="mt-4 text-xs text-zinc-500">
              Keep this tab open while the Oracle talks to Sepolia.
            </p>
          )}
        </div>
        {canClose ? (
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#C4B5FD] px-6 text-sm font-semibold text-[#1B1233] transition hover:bg-[#d4c8ff]"
          >
            Continue
          </button>
        ) : null}
      </div>
    </div>
  );
}
