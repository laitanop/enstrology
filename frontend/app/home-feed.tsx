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
      : /not deployed at|Missing ENSTROLOGYP_PAY_ADDRESS/i.test(message)
        ? "The Cosmic Feed could not reach the Sepolia pay contract. On Vercel, set ENSTROLOGYP_PAY_ADDRESS and NEXT_PUBLIC_ENSTROLOGYP_PAY_ADDRESS to the same address that works on localhost."
        : error instanceof Error
          ? error.message
          : "Could not load the feed.";
  }

  return <HomeFeedList initialCards={cards} loadError={loadError} />;
}
