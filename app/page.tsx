export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-20">
      <section className="w-full rounded-2xl border border-white/20 bg-white/70 p-8 shadow-xl backdrop-blur md:p-12">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
          PrepIQ
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
          Kitchen Intelligence & Margin Protection
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700 md:text-lg">
          PrepIQ is an operational control layer for professional kitchens. It
          turns daily operational noise into clear actions: what to produce,
          where margin is leaking, who owns the problem, and what to fix before
          tomorrow service.
        </p>
      </section>
    </main>
  );
}
