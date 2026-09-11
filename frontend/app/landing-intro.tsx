"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LINES = [
  "Hello. I'm the Oracle — your AI horoscope writer.",
  "I read your name's birthday — the day your ENS name was created.",
  "I write you a fun horoscope — based on that date and your name's personality.",
  "The horoscope gets its own name — like vitalik-20260904.oracle.enscope.eth.",
  "I can only edit the horoscope — I cannot touch your name, your wallet, or anything else. That's the deal.",
  "You stay in control — if you don't want me writing anymore, you click Revoke andI stop. It's that simple.**.",
];

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return reduced;
}

export default function LandingIntro() {
  const reducedMotion = usePrefersReducedMotion();
  const [lineIndex, setLineIndex] = useState(0);
  const [typedCount, setTypedCount] = useState(0);

  const currentLine = LINES[lineIndex];
  const lineComplete = typedCount >= currentLine.length;
  const isLastLine = lineIndex === LINES.length - 1;

  useEffect(() => {
    if (reducedMotion) {
      setTypedCount(LINES[lineIndex].length);
      return;
    }

    if (typedCount >= LINES[lineIndex].length) {
      return;
    }

    const timer = window.setTimeout(() => {
      setTypedCount((count) => count + 1);
    }, 36);
    return () => window.clearTimeout(timer);
  }, [lineIndex, reducedMotion, typedCount]);

  const finishOrAdvance = () => {
    if (!lineComplete) {
      setTypedCount(currentLine.length);
      return;
    }
    if (!isLastLine) {
      setLineIndex((index) => index + 1);
      setTypedCount(0);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col px-4 py-6 text-zinc-100">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          <img
            src="/images/logo.svg"
            alt=""
            width={58}
            height={40}
            className="h-10 w-auto"
          />
          ENStrology
        </p>
        <Link
          href="/home"
          className="inline-flex min-h-11 items-center rounded-full px-4 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
        >
          Skip
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center py-8">
        <h1 className="sr-only">Meet the Oracle</h1>

        <div className="flex w-full flex-col items-center gap-6 sm:flex-row sm:items-end sm:justify-center sm:gap-8">
          <img
            src="/images/oracle.svg"
            alt="The Oracle, a blue cosmic character with a purple crystal body"
            width={220}
            height={318}
            className="h-56 w-auto shrink-0 motion-safe:animate-[oracle-float_3.6s_ease-in-out_infinite] sm:h-72"
          />

          <div className="relative w-full max-w-md">
            <span
              className="absolute -top-2 left-1/2 z-0 size-4 -translate-x-1/2 rotate-45 border-t border-l border-white/10 bg-[#141022] sm:top-10 sm:-left-2 sm:translate-x-0 sm:border-t-0 sm:border-b"
              aria-hidden
            />
            <div className="relative z-10">
              <p
                className="min-h-[7.5rem] rounded-[24px] border border-white/10 bg-[#141022]/90 px-5 py-4 text-left text-base leading-7 text-zinc-100 shadow-[0_16px_50px_rgba(0,0,0,0.35)]"
                aria-live="polite"
              >
                {currentLine.slice(0, typedCount)}
                {!lineComplete ? (
                  <span
                    className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-[#C4B5FD] align-middle motion-safe:animate-pulse"
                    aria-hidden
                  />
                ) : null}
              </p>
              <p className="mt-2 text-right text-xs text-zinc-500">
                {lineIndex + 1} / {LINES.length}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex min-h-12 w-full max-w-md items-center justify-center">
          {isLastLine && lineComplete ? (
            <Link
              href="/home"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#C4B5FD] px-6 text-sm font-semibold text-[#1B1233] transition hover:bg-[#d4c8ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              Continue
            </Link>
          ) : (
            <button
              type="button"
              onClick={finishOrAdvance}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#C4B5FD] px-6 text-sm font-semibold text-[#1B1233] transition hover:bg-[#d4c8ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              {lineComplete ? "Next" : "Show all"}
            </button>
          )}
        </div>
      </main>

      <style>{`
        @keyframes oracle-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
