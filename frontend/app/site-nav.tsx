'use client';

import Link from 'next/link';
import NavConnect from './nav-connect';

type SiteNavProps = {
  current: 'create' | 'feed';
};

export default function SiteNav({ current }: SiteNavProps) {
  const linkClass = (page: SiteNavProps['current']): string =>
    current === page
      ? 'rounded-full bg-violet-500/20 px-3.5 py-2 text-sm font-medium text-violet-200'
      : 'rounded-full px-3.5 py-2 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white';

  return (
    <nav className="mb-6 flex items-center justify-between gap-4">
      <p className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight">
        <img
          src="/images/logo.svg"
          alt="ENStrology"
          width={58}
          height={40}
          className="h-10 w-auto"
        />
        ENStrology
      </p>
      <div className="flex shrink-0 items-center gap-3">
        <Link href="/" className={linkClass('create')}>
          Create
        </Link>
        <Link href="/feed" className={linkClass('feed')}>
          Cosmic Feed
        </Link>
        <NavConnect />
      </div>
    </nav>
  );
}
