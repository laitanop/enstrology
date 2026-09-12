"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LINES = [
  {
    text: "Hello. I'm the Oracle — your AI horoscope writer.",
    icon: "spark",
  },
  {
    text: "I read your name's birthday — the day your ENS name was created.",
    icon: "calendar",
  },
  {
    text: "I write a fun horoscope for you — based on that date and your name's personality.",
    icon: "stars",
  },
  {
    text: "The horoscope gets its own name — like vitalik-20260904.oracle.enstrology.eth.",
    icon: "tag",
  },
  {
    text: "I can only write the horoscope — I cannot touch your name, your wallet, or anything else. That's the deal.",
    icon: "shield",
  },
  {
    text: "You stay in control — if you don't want me writing anymore, you click Revoke and I stop. It's that simple.",
    icon: "revoke",
  },
  {
    text: "Let's try it — connect your wallet on Sepolia and I'll read your stars.",
    icon: "try",
  },
] as const;

type LineIcon = (typeof LINES)[number]["icon"];

function LineIconMark({ name }: { name: LineIcon }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    className: "h-5 w-5 shrink-0 text-[#E8C56A]",
    "aria-hidden": true as const,
  };

  if (name === "spark") {
    return (
      <svg {...common}>
        <path
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
          d="M12 3.5v3M12 17.5v3M4.8 7.2l2.1 2.1M17.1 16.7l2.1 2.1M3.5 12h3M17.5 12h3M4.8 16.8l2.1-2.1M17.1 7.3l2.1-2.1"
        />
        <circle cx="12" cy="12" r="2.4" fill="currentColor" />
      </svg>
    );
  }

  if (name === "calendar") {
    return (
      <svg {...common}>
        <rect x="4" y="5.5" width="16" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        <path stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" d="M8 3.5v4M16 3.5v4M4 10h16" />
      </svg>
    );
  }

  if (name === "stars") {
    return (
      <svg {...common}>
        <path
          fill="currentColor"
          d="M12 3.5 13.6 8h4.7l-3.8 2.8 1.5 4.6L12 12.7 8 15.4l1.5-4.6L5.7 8h4.7z"
        />
      </svg>
    );
  }

  if (name === "tag") {
    return (
      <svg {...common}>
        <path
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.8"
          d="M4.5 12.2V5.5H11.2l8.3 8.3-5.7 5.7z"
        />
        <circle cx="8.2" cy="9.2" r="1.1" fill="currentColor" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg {...common}>
        <path
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.8"
          d="M12 3.8 19 6.2v5.3c0 4.4-3 6.8-7 8.7-4-1.9-7-4.3-7-8.7V6.2z"
        />
      </svg>
    );
  }

  if (name === "revoke") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.8" />
        <path stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" d="m8.2 8.2 7.6 7.6" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="M5 12h12M13 7l5 5-5 5"
      />
    </svg>
  );
}

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

  const currentLine = LINES[lineIndex].text;
  const lineComplete = typedCount >= currentLine.length;
  const isLastLine = lineIndex === LINES.length - 1;

  useEffect(() => {
    if (reducedMotion) {
      setTypedCount(LINES[lineIndex].text.length);
      return;
    }

    if (typedCount >= LINES[lineIndex].text.length) {
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
      <header className="mx-auto flex w-full max-w-3xl justify-center pt-2">
        <h1 className="font-display relative px-10 text-center text-4xl font-semibold tracking-wide text-[#FFF6D6] italic sm:text-5xl">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-0"
          >
            <span className="absolute top-0 left-2 size-1.5 rounded-full bg-[#E8C56A] motion-safe:animate-[star-twinkle_2.2s_ease-in-out_infinite]" />
            <span className="absolute top-3 right-0 size-2 rounded-full bg-[#F8E7B0] motion-safe:animate-[star-drift_3.4s_ease-in-out_infinite]" />
            <span className="absolute -bottom-1 left-8 size-1 rounded-full bg-white motion-safe:animate-[star-twinkle_1.8s_ease-in-out_infinite_0.4s]" />
            <span className="absolute top-1 left-1/3 size-1 rounded-full bg-[#E8C56A] motion-safe:animate-[star-drift_2.8s_ease-in-out_infinite_0.6s]" />
            <span className="absolute -top-2 right-10 size-1.5 rounded-full bg-white motion-safe:animate-[star-twinkle_2.6s_ease-in-out_infinite_1s]" />
            <span className="absolute right-4 bottom-0 size-1 rounded-full bg-[#E8C56A] motion-safe:animate-[star-drift_3s_ease-in-out_infinite_0.2s]" />
          </span>
          <span className="relative">ENStrology</span>
        </h1>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center py-8">

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
                className="font-display flex min-h-[7.5rem] gap-3 rounded-[24px] border border-[#E8C56A]/20 bg-[#141022]/90 px-5 py-4 text-left text-lg leading-8 font-medium tracking-wide text-[#FFF6D6] italic shadow-[0_16px_50px_rgba(0,0,0,0.35)] sm:text-xl sm:leading-8"
                aria-live="polite"
              >
                <span className="mt-1 inline-flex size-8 items-center justify-center rounded-full bg-[#E8C56A]/15">
                  <LineIconMark name={LINES[lineIndex].icon} />
                </span>
                <span className="min-w-0 flex-1">
                  {currentLine.slice(0, typedCount)}
                  {!lineComplete ? (
                    <span
                      className="ml-0.5 inline-block h-5 w-[2px] translate-y-0.5 bg-[#E8C56A] align-middle motion-safe:animate-pulse"
                      aria-hidden
                    />
                  ) : null}
                </span>
              </p>
              <p className="mt-2 text-right text-xs text-zinc-500">
                {lineIndex + 1} / {LINES.length}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex min-h-12 w-full max-w-md items-center gap-3">
          <Link
            href="/home"
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          >
            Skip
          </Link>
          {isLastLine && lineComplete ? (
            <Link
              href="/home"
              className="inline-flex min-h-12 flex-[1.4] items-center justify-center rounded-2xl bg-[#C4B5FD] px-5 text-sm font-semibold text-[#1B1233] transition hover:bg-[#d4c8ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              Let’s try it
            </Link>
          ) : (
            <button
              type="button"
              onClick={finishOrAdvance}
              className="inline-flex min-h-12 flex-[1.4] items-center justify-center rounded-2xl bg-[#C4B5FD] px-5 text-sm font-semibold text-[#1B1233] transition hover:bg-[#d4c8ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              {lineComplete ? "Next" : "Show all"}
            </button>
          )}
        </div>
      </main>

      <footer className="mx-auto mt-4 w-full max-w-2xl px-2 pb-2 text-center text-xs leading-5 text-zinc-500">
        <p>Built for ETHOnline Hackathon 2026 · Best Use of ENSv2</p>
        <p className="mt-1">
          Next.js · wagmi · RainbowKit · viem · ENSv2 · OpenRouter
        </p>
        <p className="mt-1 text-[#E8C56A]/80">Demo on Ethereum Sepolia</p>
      </footer>

      <style>{`
        @keyframes oracle-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes star-twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.7); }
          50% { opacity: 1; transform: scale(1.25); }
        }
        @keyframes star-drift {
          0%, 100% { opacity: 0.35; transform: translate(0, 0) scale(0.8); }
          50% { opacity: 1; transform: translate(6px, -8px) scale(1.2); }
        }
      `}</style>
    </div>
  );
}
