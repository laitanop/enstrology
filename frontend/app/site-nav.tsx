import Link from 'next/link';

type SiteNavProps = {
  current: 'create' | 'feed';
};

export default function SiteNav({ current }: SiteNavProps) {
  const linkClass = (page: SiteNavProps['current']): string =>
    current === page
      ? 'rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white'
      : 'rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900';

  return (
    <nav className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-semibold tracking-tight">ENStrology</p>
      <div className="flex gap-2">
        <Link href="/" className={linkClass('create')}>
          Create
        </Link>
        <Link href="/feed" className={linkClass('feed')}>
          Cosmic Feed
        </Link>
      </div>
    </nav>
  );
}