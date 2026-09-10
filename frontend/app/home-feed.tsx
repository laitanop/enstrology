import { listPublishedReadings } from "@/lib/feed";
import HomeFeedList from "./home-feed-list";

export default async function HomeFeed() {
  let cards: Awaited<ReturnType<typeof listPublishedReadings>> = [];
  let loadError = "";

  try {
    cards = await listPublishedReadings();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    loadError = /rate limit|exceeds defined limit|too many requests/i.test(
      message,
    )
      ? "Sepolia RPC is busy. Wait a few seconds and refresh."
      : error instanceof Error
        ? error.message
        : "Could not load the feed.";
  }

  return <HomeFeedList initialCards={cards} loadError={loadError} />;
}
