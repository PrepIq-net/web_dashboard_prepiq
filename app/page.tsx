"use client";

import { useCurrentUserProfile } from "@/services";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { data: user, isLoading } = useCurrentUserProfile();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && !user.has_organization) {
      router.replace("/onboarding");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-1">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="h-12 w-12 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-text-muted">
            Resolving workspace state...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1440px] items-center px-8 py-20 animate-fade-in">
      <section className="w-full rounded-card border border-border-default bg-surface-2 p-8 shadow-[var(--shadow-level-1)] md:p-12">
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

        {user && (
          <div className="mt-8 flex items-center gap-2 rounded-full bg-brand-gold/5 border border-brand-gold/10 px-4 py-2 text-xs font-medium text-text-secondary w-fit">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-gold opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-gold"></span>
            </span>
            Connected as {user.first_name} {user.last_name}
          </div>
        )}
      </section>
    </main>
  );
}
