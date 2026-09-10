"use client";

import { useState, useTransition } from "react";
import type { FeedCard } from "@/lib/feed";
import {
  formatLongBirthdate,
  formatLuckyColorName,
  luckyColorSwatch,
  shortAddress,
} from "@/lib/reading-display";
import { revokeReadingOracleAction } from "./actions";

const ORACLE_ENS_NAME = "oracle.enstrology.eth";

type ReadingDetailProps = {
  card: FeedCard;
};

function ClockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 4.6V8.2L10.4 9.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3.4"
        y="7.2"
        width="9.2"
        height="6.2"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M5.4 7.2V5.6a2.6 2.6 0 0 1 5.2 0v1.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ConstellationMark() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
      <circle
        cx="36"
        cy="36"
        r="34"
        fill="#120c24"
        stroke="rgba(255,255,255,0.12)"
      />
      <circle cx="22" cy="24" r="2.2" fill="#E8C56A" />
      <circle cx="38" cy="18" r="2.2" fill="#E8C56A" />
      <circle cx="52" cy="28" r="2.2" fill="#E8C56A" />
      <circle cx="46" cy="46" r="2.2" fill="#E8C56A" />
      <circle cx="28" cy="50" r="2.2" fill="#E8C56A" />
      <path
        d="M22 24 L38 18 L52 28 L46 46 L28 50 Z"
        fill="none"
        stroke="#C4B5FD"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export default function ReadingDetail({ card }: ReadingDetailProps) {
  const [isPending, startTransition] = useTransition();
  const [revokeMessage, setRevokeMessage] = useState("");
  const explorerUrl = card.readingEnsName
    ? `https://explorer.ens.dev/${card.readingEnsName}`
    : "";
  const paymentUrl = card.paymentTxHash
    ? `https://sepolia.etherscan.io/tx/${card.paymentTxHash}`
    : "";

  const onRevoke = (): void => {
    if (!card.readingEnsName) {
      setRevokeMessage("This reading has no ENS name to revoke.");
      return;
    }
    startTransition(async () => {
      const result = await revokeReadingOracleAction(card.readingEnsName);
      setRevokeMessage(result.message);
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
      <section className="rounded-[28px] border border-white/10 bg-[#141022]/85 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.28)] sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            AI-generated entertainment
          </p>
          <p className="flex items-center gap-2 text-zinc-400">
            <img
              src="/images/oracle.svg"
              alt=""
              width={28}
              height={40}
              className="h-10 w-auto"
            />
            Read by {ORACLE_ENS_NAME}
          </p>
        </div>

        <div className="mt-6 flex items-start gap-4">
          <ConstellationMark />
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#E8C56A] uppercase">
              {card.sign || "Sign"}
              {card.birthdate
                ? ` · Born onchain ${formatLongBirthdate(card.birthdate)}`
                : ""}
            </p>
            <h1 className="font-display mt-2 text-3xl text-white sm:text-4xl">
              {card.title || "Untitled reading"}
            </h1>
          </div>
        </div>

        <p className="mt-5 whitespace-pre-wrap text-base leading-7 text-zinc-300">
          {card.reading}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          {card.luckyColor ? (
            <div className="rounded-2xl border border-white/10 bg-[#0c0a18] px-4 py-3">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
                Lucky color
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm text-white">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: luckyColorSwatch(card.luckyColor) }}
                />
                {formatLuckyColorName(card.luckyColor)}
              </p>
            </div>
          ) : null}
          {card.luckyNumber ? (
            <div className="rounded-2xl border border-white/10 bg-[#0c0a18] px-4 py-3">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
                Lucky number
              </p>
              <p className="mt-1 text-sm text-white">{card.luckyNumber}</p>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-[28px] border border-white/10 bg-[#141022]/85 p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-300">
            <span aria-hidden="true">✓</span>
            Verified onchain facts
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="text-zinc-500">Source name</dt>
              <dd className="text-right text-white">{card.sourceEnsName}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-zinc-500">ENS birthday</dt>
              <dd className="text-right text-white">
                {card.birthdate ? formatLongBirthdate(card.birthdate) : "—"}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-zinc-500">Owner</dt>
              <dd
                className="cursor-help text-right font-mono text-xs text-white"
                title={card.buyer}
              >
                {shortAddress(card.buyer)}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-zinc-500">Payment</dt>
              <dd className="text-right">
                {paymentUrl ? (
                  <a
                    href={paymentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-violet-300 underline"
                  >
                    {shortAddress(card.paymentTxHash || "")}
                  </a>
                ) : (
                  <span className="text-white">Onchain</span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-[#141022]/85 p-5">
          <p className="text-sm font-medium text-white">
            Your reading lives at
          </p>
          {card.readingEnsName ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block break-all rounded-md border border-white/10 bg-[#16111F] px-4 py-3 text-sm text-[#C4B5FD] hover:text-[#d4c8ff]"
            >
              {card.readingEnsName}
            </a>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">
              ENS name still indexing.
            </p>
          )}
          <ul className="mt-4 space-y-3 text-sm text-[#A8A0BF]">
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 text-[#E8C56A]">
                <ClockIcon />
              </span>
              <span>
                Expires {formatLongBirthdate(card.expiresAt.slice(0, 10))}
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 text-[#E8C56A]">
                <LockIcon />
              </span>
              <span>Non-transferable — yours alone</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5">
                <img
                  src="/images/logo.svg"
                  alt=""
                  width={16}
                  height={11}
                  className="h-4 w-auto"
                />
              </span>
              <span>Oracle may edit horoscope records only</span>
            </li>
          </ul>
          <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#A8A0BF]">
              Not happy with your Oracle?
            </p>
            <button
              type="button"
              onClick={onRevoke}
              disabled={isPending}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#EC8B57]/50 px-4 text-sm font-medium text-[#F75B06] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Revoking..." : "Revoke its access"}
            </button>
          </div>
          {revokeMessage ? (
            <p className="mt-2 text-xs text-zinc-500">{revokeMessage}</p>
          ) : null}
        </section>
      </aside>
    </div>
  );
}
