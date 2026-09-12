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
      className="group block rounded-[28px] border border-white/15 bg-[#1a1430] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] outline-none transition duration-200 hover:border-[#E8C56A]/80 hover:bg-[#221a3d] hover:shadow-[0_0_0_1px_rgba(232,197,106,0.35),0_16px_48px_rgba(232,197,106,0.18)] focus-visible:ring-2 focus-visible:ring-[#E8C56A]/80"
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
        <span className="text-violet-300 transition group-hover:text-[#E8C56A]">
          Open reading →
        </span>
      </div>
    </Link>
  );
}
