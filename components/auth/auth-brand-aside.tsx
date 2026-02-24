export function AuthBrandAside() {
  return (
    <aside className="relative hidden min-h-screen bg-surface-3 p-8 md:p-12 lg:flex lg:items-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(168,130,31,0.2),transparent_45%),radial-gradient(circle_at_10%_100%,rgba(58,110,165,0.2),transparent_48%)]" />

      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-col gap-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-gold">
            Kitchen Intelligence
          </p>
          <h2 className="mt-5 font-display text-[40px] font-semibold leading-[48px] tracking-tight text-text-primary">
            Control margin variance before service starts.
          </h2>
          <p className="mt-6 text-[16px] leading-[24px] text-text-secondary">
            PrepIQ translates prep activity into financial signal. Detect leakage,
            assign ownership, and execute corrective actions by the next shift.
          </p>
        </div>

        <div className="rounded-card border border-border-default bg-surface-2/70 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
            Daily Discipline
          </p>
          <p className="mt-3 text-[14px] leading-[22px] text-text-secondary">
            "Production delta flagged at +12%. Recommended action issued before opening."
          </p>
        </div>
      </div>
    </aside>
  );
}
