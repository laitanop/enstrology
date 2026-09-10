'use client';

import { useState, useTransition } from 'react';
import { useAccount } from 'wagmi';
import type { FeedCard } from '@/lib/feed';
import {
  formatLongBirthdate,
  luckyColorSwatch,
  shortAddress,
} from '@/lib/reading-display';
import { revokeReadingOracleAction } from './actions';

const ORACLE_ENS_NAME = 'oracle.enstrology.eth';

type ReadingDetailProps = {
  card: FeedCard;
};

function ConstellationMark() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r="34" fill="#120c24" stroke="rgba(255,255,255,0.12)" />
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
  const { address } = useAccount();
  const [isPending, startTransition] = useTransition();
  const [revokeMessage, setRevokeMessage] = useState('');
  const isBuyer =
    Boolean(address) && address?.toLowerCase() === card.buyer.toLowerCase();
  const explorerUrl = card.readingEnsName
    ? `https://explorer.ens.dev/${card.readingEnsName}`
    : '';
  const paymentUrl = card.paymentTxHash
    ? `https://sepolia.etherscan.io/tx/${card.paymentTxHash}`
    : '';

  const onRevoke = (): void => {
    if (!card.readingEnsName) {
      setRevokeMessage('This reading has no ENS name to revoke.');
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
              {card.sign || 'Sign'}
              {card.birthdate ? ` · Born onchain ${formatLongBirthdate(card.birthdate)}` : ''}
            </p>
            <h1 className="font-display mt-2 text-3xl text-white sm:text-4xl">
              {card.title || 'Untitled reading'}
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
                {card.luckyColor}
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
        <div className="flex justify-center lg:justify-end">
          <img
            src="/images/oracle.svg"
            alt="The ENStrology Oracle"
            width={220}
            height={318}
            className="h-44 w-auto drop-shadow-[0_24px_40px_rgba(12,8,32,0.65)] sm:h-52 lg:h-56"
          />
        </div>
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
                {card.birthdate ? formatLongBirthdate(card.birthdate) : '—'}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-zinc-500">Owner</dt>
              <dd className="text-right font-mono text-xs text-white">
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
                    {shortAddress(card.paymentTxHash || '')}
                  </a>
                ) : (
                  <span className="text-white">Onchain</span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-[#141022]/85 p-5">
          <p className="text-sm font-medium text-white">Your reading lives at</p>
          {card.readingEnsName ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block break-all rounded-2xl border border-violet-400/20 bg-violet-500/10 px-3 py-3 text-sm text-violet-200"
            >
              {card.readingEnsName}
            </a>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">ENS name still indexing.</p>
          )}
          <ul className="mt-4 space-y-2 text-sm text-zinc-400">
            <li>Expires {formatLongBirthdate(card.expiresAt.slice(0, 10))}</li>
            <li>Non-transferable — yours alone</li>
            <li>Oracle may edit horoscope records only</li>
          </ul>
          {isBuyer ? (
            <button
              type="button"
              onClick={onRevoke}
              disabled={isPending}
              className="mt-5 min-h-11 w-full rounded-2xl border border-rose-400/30 text-sm font-medium text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-60"
            >
              {isPending ? 'Revoking...' : 'Revoke its access'}
            </button>
          ) : null}
          {revokeMessage ? (
            <p className="mt-2 text-xs text-zinc-500">{revokeMessage}</p>
          ) : null}
        </section>
      </aside>
    </div>
  );
}
