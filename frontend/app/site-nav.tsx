'use client';

import Link from 'next/link';
import NavConnect from './nav-connect';
import NetworkNotice from './network-notice';

export default function SiteNav() {
  return (
    <div className="mb-6">
      <nav className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight text-white"
        >
          <img
            src="/images/logo.svg"
            alt="ENStrology"
            width={58}
            height={40}
            className="h-10 w-auto"
          />
          ENStrology
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          <a
            href="/home#feed"
            className="rounded-full px-3.5 py-2 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white"
          >
            Feed
          </a>
          <NavConnect />
        </div>
      </nav>
      <NetworkNotice />
    </div>
  );
}
