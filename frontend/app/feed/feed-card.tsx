import Link from 'next/link';
import type { FeedCard } from '@/lib/feed';
import { formatBirthdate, readingSnippet } from '@/lib/reading-display';

type FeedCardLinkProps = {
  card: FeedCard;
};

export default function FeedCardLink({ card }: FeedCardLinkProps) {
  const params = new URLSearchParams();
  if (card.readingEnsName) {
    params.set("ens", card.readingEnsName);
  }
  if (card.paymentTxHash) {
    params.set("pay", card.paymentTxHash);
  }
  const query = params.toString();
  const href = `/feed/${card.readingNamehash}${query ? `?${query}` : ""}`;

  return (
    <Link
      href={href}
      className="block rounded-[28px] border border-white/10 bg-[#141022]/85 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.28)] outline-none transition hover:border-violet-400/40 focus-visible:ring-2 focus-visible:ring-violet-400/70"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-white">{card.sourceEnsName}</p>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-[#E8C56A] uppercase">
          {card.sign || 'Sign'}
        </p>
      </div>
      <h2 className="font-display mt-3 text-xl text-white">
        {card.title || 'Untitled reading'}
      </h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        {readingSnippet(card.reading)}
      </p>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-zinc-500">
        <p>{card.birthdate ? `Born ${formatBirthdate(card.birthdate)}` : 'Onchain birthday'}</p>
        <span className="text-violet-300">verify →</span>
      </div>
    </Link>
  );
}
