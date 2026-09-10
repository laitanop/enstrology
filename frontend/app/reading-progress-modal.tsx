"use client";

import { useEffect, useId, useRef } from "react";

export type ReadingProgressStep =
  | "prepare"
  | "approve"
  | "pay"
  | "publish"
  | "create";

export type ReadingProgressStatus = "running" | "success" | "error";

type ReadingProgressModalProps = {
  open: boolean;
  status: ReadingProgressStatus;
  step: ReadingProgressStep;
  message: string;
  purchaseTxHash: string;
  approveTxHash: string;
  publishTxHash: string;
  errorMessage: string;
  onClose: () => void;
};

const STEPS: Array<{ id: ReadingProgressStep; label: string }> = [
  { id: "prepare", label: "Prepare wallet" },
  { id: "approve", label: "Approve 0.01 USDC" },
  { id: "pay", label: "Pay for the reading" },
  { id: "publish", label: "Share on Cosmic Feed" },
  { id: "create", label: "Write the horoscope" },
];

function sepoliaTxUrl(hash: string): string {
  return `https://sepolia.etherscan.io/tx/${hash}`;
}

function shortHash(hash: string): string {
  if (hash.length < 12) {
    return hash;
  }
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function stepStatus(
  stepId: ReadingProgressStep,
  current: ReadingProgressStep,
  status: ReadingProgressStatus,
): "done" | "active" | "wait" {
  const currentIndex = STEPS.findIndex((item) => item.id === current);
  const stepIndex = STEPS.findIndex((item) => item.id === stepId);
  if (status === "success") {
    return "done";
  }
  if (stepIndex < currentIndex) {
    return "done";
  }
  if (stepIndex === currentIndex) {
    return "active";
  }
  return "wait";
}

function Spinner() {
  return (
    <span
      className="inline-block size-10 animate-spin rounded-full border-2 border-violet-300/25 border-t-[#C4B5FD] motion-reduce:animate-none"
      aria-hidden
    />
  );
}

export default function ReadingProgressModal({
  open,
  status,
  step,
  message,
  purchaseTxHash,
  approveTxHash,
  publishTxHash,
  errorMessage,
  onClose,
}: ReadingProgressModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const canClose = status === "success" || status === "error";

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-busy={!canClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-[28px] border border-white/10 bg-[#141022] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)] sm:p-7">
        <div className="flex items-start gap-4">
          {status === "success" ? (
            <span
              className="mt-0.5 flex size-10 items-center justify-center rounded-full bg-emerald-500/15 text-lg text-emerald-300"
              aria-hidden
            >
              ✓
            </span>
          ) : status === "error" ? (
            <span
              className="mt-0.5 flex size-10 items-center justify-center rounded-full bg-rose-500/15 text-lg text-rose-300"
              aria-hidden
            >
              !
            </span>
          ) : (
            <Spinner />
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-2xl text-white">
              {status === "success"
                ? "Reading is ready"
                : status === "error"
                  ? "Could not finish"
                  : "Revealing your ENStrology"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              {status === "success"
                ? "Close this window to see your new post in the Cosmic Feed."
                : status === "error"
                  ? errorMessage || message || "Something went wrong."
                  : message || "Please confirm in your wallet…"}
            </p>
          </div>
        </div>

        <ol className="mt-6 space-y-3">
          {STEPS.map((item) => {
            const itemStatus = stepStatus(item.id, step, status);
            return (
              <li key={item.id} className="flex items-start gap-3 text-sm">
                <span
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                    itemStatus === "done"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : itemStatus === "active"
                        ? "bg-violet-400/20 text-violet-200"
                        : "bg-white/5 text-zinc-500"
                  }`}
                  aria-hidden
                >
                  {itemStatus === "done"
                    ? "✓"
                    : itemStatus === "active"
                      ? "●"
                      : ""}
                </span>
                <div className="min-w-0">
                  <p
                    className={
                      itemStatus === "wait" ? "text-zinc-500" : "text-zinc-100"
                    }
                  >
                    {item.label}
                  </p>
                  {item.id === "approve" && approveTxHash ? (
                    <a
                      href={sepoliaTxUrl(approveTxHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 block break-all text-xs text-violet-300 underline underline-offset-2"
                    >
                      Approve {shortHash(approveTxHash)}
                    </a>
                  ) : null}
                  {item.id === "pay" && purchaseTxHash ? (
                    <a
                      href={sepoliaTxUrl(purchaseTxHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 block break-all text-xs text-violet-300 underline underline-offset-2"
                    >
                      Payment {shortHash(purchaseTxHash)}
                    </a>
                  ) : null}
                  {item.id === "publish" && publishTxHash ? (
                    <a
                      href={sepoliaTxUrl(publishTxHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 block break-all text-xs text-violet-300 underline underline-offset-2"
                    >
                      Publish {shortHash(publishTxHash)}
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>

        {canClose ? (
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#C4B5FD] px-6 text-sm font-semibold text-[#1B1233] transition hover:bg-[#d4c8ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          >
            {status === "success" ? "Close and see the feed" : "Close"}
          </button>
        ) : (
          <p className="mt-6 text-center text-xs text-zinc-500">
            Keep this tab open while your wallet and the Oracle finish.
          </p>
        )}
      </div>
    </div>
  );
}
