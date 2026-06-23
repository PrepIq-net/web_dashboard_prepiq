import { Suspense } from "react";
import { AuthLogoRow } from "@/components/auth/auth-logo-row";
import { AuthHeaderBadge } from "@/components/auth/auth-header-badge";
import { AuthFooter } from "@/components/auth/auth-footer";
import { RecoveryVerifyForm } from "./recovery-verify-form";

export default function RecoveryVerifyPage() {
  return (
    <main className="min-h-screen bg-bg-base overflow-x-hidden">
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12 md:px-12 md:py-24">
        {/* Background glow for a "pro" feel */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-brand-gold/5 blur-[120px]" />

        <header className="relative z-10 flex items-center justify-between mb-20">
          <AuthLogoRow size={48} />
          <AuthHeaderBadge labelKey="auth.securityProtocol" />
        </header>

        <section className="relative z-10 flex-1 flex flex-col items-center">
          <Suspense
            fallback={
              <div className="w-full max-w-md h-96 rounded-lg bg-surface-2 animate-pulse" />
            }
          >
            <RecoveryVerifyForm />
          </Suspense>
        </section>

        <AuthFooter />
      </div>
    </main>
  );
}
