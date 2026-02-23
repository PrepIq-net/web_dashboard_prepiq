export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1440px] items-center px-8 py-20">
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
      </section>
    </main>
  );
}
