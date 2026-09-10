import Link from 'next/link';
import { notFound } from 'next/navigation';
import SiteNav from '../../site-nav';
import { getPublishedReading } from '@/lib/feed';
import ReadingDetail from '../reading-detail';

export const dynamic = 'force-dynamic';

const READING_NAMEHASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

type ReadingPageProps = {
  params: Promise<{ readingNamehash: string }>;
  searchParams: Promise<{ ens?: string; pay?: string }>;
};

export default async function ReadingPage({ params, searchParams }: ReadingPageProps) {
  const { readingNamehash } = await params;
  const { ens, pay } = await searchParams;
  if (!READING_NAMEHASH_REGEX.test(readingNamehash)) {
    notFound();
  }

  const card = await getPublishedReading(
    readingNamehash as `0x${string}`,
    ens,
    pay,
  );
  if (!card) {
    notFound();
  }

  return (
    <div className="min-h-screen px-4 py-10 text-zinc-100">
      <div className="mx-auto w-full max-w-5xl">
        <SiteNav />
      </div>
      <main className="mx-auto w-full max-w-5xl">
        <Link
          href="/#feed"
          className="mb-5 inline-flex min-h-11 items-center text-sm text-zinc-400 hover:text-white"
        >
          ← Home
        </Link>
        <ReadingDetail card={card} />
      </main>
    </div>
  );
}
