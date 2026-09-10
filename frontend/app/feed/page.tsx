import SiteNav from '../site-nav';
import { listPublishedReadings } from '@/lib/feed';

export const dynamic = 'force-dynamic';

export default async function CosmicFeedPage() {
  let cards: Awaited<ReturnType<typeof listPublishedReadings>> = [];
  let loadError = '';

  try {
    cards = await listPublishedReadings();
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Could not load the feed.';
  }

  return (
    <div className="min-h-screen px-4 py-10 text-zinc-100">
      <div className="mx-auto w-full max-w-5xl">
        <SiteNav current="feed" />
      </div>
      <main className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Cosmic Feed</h1>
        <p className="mt-2 text-sm text-zinc-300">
          Public horoscopes from ENS names. Anyone can read these. Private readings stay hidden.
        </p>

        {loadError ? (
          <div className="mt-6 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {loadError}
          </div>
        ) : null}

        {!loadError && cards.length === 0 ? (
          <div className="mt-6 rounded-xl border border-white/15 bg-white/90 p-6 text-sm text-zinc-700 backdrop-blur-md">
            No public readings yet. Create a horoscope and set visibility to public.
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          {cards.map((card) => (
            <article
              key={card.readingNamehash}
              className="rounded-2xl border border-white/15 bg-white/90 p-5 text-zinc-900 shadow-sm backdrop-blur-md"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
                {card.sign || 'Horoscope'}
              </p>
              <h2 className="mt-1 text-lg font-semibold">{card.title || 'Untitled reading'}</h2>
              <p className="mt-1 text-sm text-zinc-600">
                {card.sourceEnsName}
                {card.birthdate ? ` · birthday ${card.birthdate}` : ''}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-800">
                {card.reading}
              </p>
              {(card.luckyColor || card.luckyNumber) && (
                <p className="mt-3 text-xs text-zinc-500">
                  Lucky color {card.luckyColor || '—'} · Lucky number {card.luckyNumber || '—'}
                </p>
              )}
              {card.readingEnsName ? (
                <a
                  href={`https://explorer.ens.dev/${card.readingEnsName}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-xs underline"
                >
                  {card.readingEnsName}
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}