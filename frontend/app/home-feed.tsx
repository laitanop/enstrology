import { listPublishedReadings } from '@/lib/feed';
import FeedCardLink from './feed/feed-card';

export default async function HomeFeed() {
  let cards: Awaited<ReturnType<typeof listPublishedReadings>> = [];
  let loadError = '';

  try {
    cards = await listPublishedReadings();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    loadError = /rate limit|exceeds defined limit|too many requests/i.test(message)
      ? 'Sepolia RPC is busy. Wait a few seconds and refresh.'
      : error instanceof Error
        ? error.message
        : 'Could not load the feed.';
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
        {loadError}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No public readings yet. Reveal one and it will show here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {cards.map((card) => (
        <FeedCardLink key={card.readingNamehash} card={card} />
      ))}
    </div>
  );
}
