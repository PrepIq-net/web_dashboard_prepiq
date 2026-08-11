import { Suspense } from "react";
import { AuthLogoRow } from "@/components/auth/auth-logo-row";
import { AuthHeaderBadge } from "@/components/auth/auth-header-badge";
import { AuthFooter } from "@/components/auth/auth-footer";
import { ShowcaseCarousel } from "@/components/auth/showcase-carousel";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-bg-base lg:grid lg:h-screen lg:grid-cols-2 lg:overflow-hidden">
      {/* Independently scrollable: the form column can be taller than one
          viewport (it's untouched by this redesign), but the showcase panel
          must always fill exactly one viewport so its headline/dots are
          never pushed below the fold. */}
      <div className="relative flex min-h-screen flex-col px-6 py-12 md:px-12 md:py-24 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:px-16 scrollbar-thin">
        {/* Background glow for a "pro" feel */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-brand-gold/5 blur-[120px]" />

        <header className="relative z-10 flex items-center justify-between mb-20">
          <AuthLogoRow size={48} />
          <AuthHeaderBadge labelKey="auth.signIn" />
        </header>

        <section className="relative z-10 flex-1 flex flex-col items-center">
          <Suspense
            fallback={
              <div className="w-full max-w-md h-96 rounded-lg bg-surface-2 animate-pulse" />
            }
          >
            <LoginForm />
          </Suspense>
        </section>

        <AuthFooter />
      </div>

      {/* Desktop-only showcase panel — see the auth redesign brief in the
          imported Claude Design project for rationale ("the form stays
          exactly where it is, the other half becomes an illustrated panel"). */}
      <ShowcaseCarousel />
    </div>
  );
}
