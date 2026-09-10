import SiteNav from '../site-nav';
import { listPublishedReadings } from '@/lib/feed';
import FeedCardLink from './feed-card';

export const dynamic = 'force-dynamic';

export default async function CosmicFeedPage() {
  let cards: Awaited<ReturnType<typeof listPublishedReadings>> = [];
  let loadError = '';

  try {
    cards = await listPublishedReadings();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    loadError =
      /rate limit|exceeds defined limit|too many requests/i.test(message)
        ? 'Sepolia RPC is busy. Wait a few seconds and refresh the feed.'
        : error instanceof Error
          ? error.message
          : 'Could not load the feed.';
  }

  return (
    <div className="min-h-screen px-4 py-10 text-zinc-100">
      <div className="mx-auto w-full max-w-5xl">
        <SiteNav current="feed" />
      </div>
      <main className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Cosmic Feed</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Horoscopes from ENS names. Tap a card to open the full reading.
        </p>

        {loadError ? (
          <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {loadError}
          </div>
        ) : null}

        {!loadError && cards.length === 0 ? (
          <div className="mt-6 rounded-[28px] border border-white/10 bg-[#141022]/80 p-6 text-sm text-zinc-400">
            No public readings yet. Create a horoscope to appear here.
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          {cards.map((card) => (
            <FeedCardLink key={card.readingNamehash} card={card} />
          ))}
        </div>
      </main>
    </div>
  );
}
