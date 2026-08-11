import type { ReactNode } from "react";
import { AuthLogoRow } from "@/components/auth/auth-logo-row";
import { AuthHeaderBadge } from "@/components/auth/auth-header-badge";
import { AuthFooter } from "@/components/auth/auth-footer";
import { ShowcaseCarousel } from "@/components/auth/showcase-carousel";

type AuthSplitShellProps = {
  /** Top-right status badge label (t() key). Omit to match register's no-badge header. */
  badgeLabelKey?: string;
  children: ReactNode;
};

/**
 * Shared shell for every /(auth) route: split layout at lg: (≥1024px) — the
 * form column stays exactly as each page already had it, the other half is
 * the showcase carousel. Single-column below lg:, unchanged from before this
 * redesign. See the auth redesign brief in the imported Claude Design
 * project — all six auth routes are in its scope checklist, not just /login.
 *
 * The form column is independently scrollable so the showcase panel always
 * fills exactly one viewport (its headline/dots would otherwise get pushed
 * below the fold on pages whose form content is taller than one screen).
 */
export function AuthSplitShell({ badgeLabelKey, children }: AuthSplitShellProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-bg-base lg:grid lg:h-screen lg:grid-cols-2 lg:overflow-hidden">
      <div className="relative flex min-h-screen flex-col px-6 py-12 md:px-12 md:py-24 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:px-16 scrollbar-thin">
        {/* Background glow for a "pro" feel */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-brand-gold/5 blur-[120px]" />

        <header className="relative z-10 flex items-center justify-between mb-20">
          <AuthLogoRow size={48} />
          {badgeLabelKey ? <AuthHeaderBadge labelKey={badgeLabelKey} /> : null}
        </header>

        <section className="relative z-10 flex-1 flex flex-col items-center">
          {children}
        </section>

        <AuthFooter />
      </div>

      <ShowcaseCarousel />
    </div>
  );
}
