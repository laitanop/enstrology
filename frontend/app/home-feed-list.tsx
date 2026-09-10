"use client";

import { useEffect, useState } from "react";
import type { FeedCard } from "@/lib/feed";
import FeedCardLink from "./feed/feed-card";

export const READING_CREATED_EVENT = "enstrology:reading-created";

export function announceNewReading(card: FeedCard): void {
  window.dispatchEvent(
    new CustomEvent(READING_CREATED_EVENT, { detail: card }),
  );
}

type HomeFeedListProps = {
  initialCards: FeedCard[];
  loadError?: string;
};

export default function HomeFeedList({
  initialCards,
  loadError = "",
}: HomeFeedListProps) {
  const [extraCards, setExtraCards] = useState<FeedCard[]>([]);

  useEffect(() => {
    const onCreated = (event: Event) => {
      const card = (event as CustomEvent<FeedCard>).detail;
      if (!card?.readingNamehash) {
        return;
      }
      setExtraCards((current) => {
        if (
          current.some(
            (item) =>
              item.readingNamehash.toLowerCase() ===
              card.readingNamehash.toLowerCase(),
          )
        ) {
          return current;
        }
        return [card, ...current];
      });
    };

    window.addEventListener(READING_CREATED_EVENT, onCreated);
    return () => window.removeEventListener(READING_CREATED_EVENT, onCreated);
  }, []);

  const seen = new Set(
    extraCards.map((card) => card.readingNamehash.toLowerCase()),
  );
  const cards = [
    ...extraCards,
    ...initialCards.filter((card) => {
      const key = card.readingNamehash.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    }),
  ];

  return (
    <div className="space-y-4">
      {loadError ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {loadError}
        </div>
      ) : null}
      {cards.length === 0 && !loadError ? (
        <p className="text-sm text-zinc-500">
          No public readings yet. Reveal one and it will show here.
        </p>
      ) : null}
      {cards.map((card) => (
        <FeedCardLink key={card.readingNamehash} card={card} />
      ))}
    </div>
  );
}
