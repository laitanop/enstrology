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
    <div className="flex min-h-dvh flex-col px-4 py-8 text-zinc-100">
      <header className="mx-auto flex w-full max-w-4xl justify-center pt-4">
        <h1 className="font-display relative px-12 text-center text-5xl font-medium tracking-[0.04em] text-[#F4E4B8] sm:text-6xl">
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
          <span className="relative drop-shadow-[0_0_24px_rgba(232,197,106,0.25)]">
            ENStrology
          </span>
        </h1>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center py-10">
        <div className="relative flex w-full flex-col items-center justify-center gap-8 px-2 sm:flex-row sm:items-center sm:gap-10">
          <svg
            aria-hidden
            viewBox="0 0 900 420"
            className="pointer-events-none absolute top-1/2 left-1/2 hidden h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2 sm:block"
          >
            <defs>
              <linearGradient id="orbitGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.15" />
                <stop offset="45%" stopColor="#C4B5FD" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.15" />
              </linearGradient>
              <filter id="orbitBlur" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" />
              </filter>
            </defs>
            <ellipse
              cx="450"
              cy="210"
              rx="400"
              ry="155"
              fill="none"
              stroke="url(#orbitGlow)"
              strokeWidth="2"
              filter="url(#orbitBlur)"
              className=""
            />
            <ellipse
              cx="450"
              cy="210"
              rx="400"
              ry="155"
              fill="none"
              stroke="#C4B5FD"
              strokeOpacity="0.28"
              strokeWidth="1"
            />
          </svg>

          <img
            src="/images/oracle.svg"
            alt="The Oracle, a blue cosmic character with a purple crystal body"
            width={220}
            height={318}
            className="relative z-10 h-52 w-auto shrink-0 drop-shadow-[0_0_40px_rgba(167,139,250,0.35)] motion-safe:animate-[oracle-float_3.6s_ease-in-out_infinite] sm:h-64"
          />

          <div className="relative z-10 w-full max-w-lg">
            <div className="rounded-[28px] border border-white/10 bg-[#12081f]/55 p-6 shadow-[0_0_50px_rgba(139,92,246,0.22)] ring-1 ring-violet-300/25 backdrop-blur-xl sm:p-7">
              <p
                className="font-display flex min-h-[5.5rem] items-start gap-3 text-left text-xl leading-8 font-medium text-[#F7E7B8] sm:text-2xl sm:leading-9"
                aria-live="polite"
              >
                <span className="mt-1 inline-flex size-8 shrink-0 items-center justify-center">
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
              <p className="mt-4 text-right text-xs tracking-wide text-violet-200/60">
                {lineIndex + 1} / {LINES.length}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 flex w-full max-w-md items-center justify-center gap-4">
          <Link
            href="/home"
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-[#2A2438] px-6 text-sm font-semibold text-[#E8E2F5] transition hover:bg-[#3A3348] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          >
            Skip
          </Link>
          {isLastLine && lineComplete ? (
            <Link
              href="/home"
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-[#D6C7FF] px-6 text-sm font-semibold text-[#2A1848] transition hover:bg-[#E4DAFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              Let’s try it
            </Link>
          ) : (
            <button
              type="button"
              onClick={finishOrAdvance}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-[#D6C7FF] px-6 text-sm font-semibold text-[#2A1848] transition hover:bg-[#E4DAFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              {lineComplete ? "Next" : "Show all"}
            </button>
          )}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-2xl px-2 pb-3 text-center text-xs leading-6 text-violet-200/45">
        <p>Built for ETHOnline Hackathon 2026 · Best Use of ENSv2</p>
        <p>Next.js · wagmi · RainbowKit · viem · ENSv2 · OpenRouter</p>
        <p className="text-[#E8C56A]/70">Demo on Ethereum Sepolia</p>
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
        @keyframes orbit-spin {
          from { transform: rotate(0deg); transform-origin: 450px 210px; }
          to { transform: rotate(360deg); transform-origin: 450px 210px; }
        }
      `}</style>
    </div>
  );
}
