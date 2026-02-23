"use client";

import { useCurrentUserProfile } from "@/services";

export default function Home() {
  const { data: user, isLoading } = useCurrentUserProfile();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1440px] items-center px-8 py-20">
      <section className="w-full rounded-card border border-border-default bg-surface-2 p-8 shadow-[var(--shadow-level-1)] md:p-12">
        {user && (
          <div className="mb-6 flex items-center gap-2 rounded-full bg-brand-gold/10 px-4 py-1.5 text-xs font-medium text-brand-gold">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-gold opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-gold"></span>
            </span>
            Authenticated: {user.first_name} {user.last_name} ({user.email})
          </div>
        )}

        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
          PrepIQ
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-[1.2] tracking-tight text-text-primary md:text-5xl">
          Kitchen Intelligence & Margin Protection
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-text-secondary md:text-lg">
          PrepIQ is an operational control layer for professional kitchens. It
          turns daily operational noise into clear actions: what to produce,
          where margin is leaking, who owns the problem, and what to fix before
          tomorrow service.
        </p>

        {isLoading && (
          <p className="mt-8 text-sm text-text-muted animate-pulse">
            Verifying session...
          </p>
        )}
      </section>
    </main>
  );
}
