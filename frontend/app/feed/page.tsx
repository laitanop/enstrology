import { redirect } from 'next/navigation';

export default function CosmicFeedPage() {
  redirect("/home#feed");
}
