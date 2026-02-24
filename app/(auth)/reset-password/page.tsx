import Link from "next/link";
import { Suspense } from "react";
import { AuthLogoRow } from "@/components/auth/auth-logo-row";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-bg-base overflow-x-hidden">
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12 md:px-12 md:py-24">
        {/* Background glow for a "pro" feel */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-brand-gold/5 blur-[120px]" />

        <header className="relative z-10 flex items-center justify-between mb-20">
          <AuthLogoRow size={48} />
          <div className="hidden md:block">
            <p className="text-sm font-medium text-text-muted">
              Security Protocol
            </p>
          </div>
        </header>

        <section className="relative z-10 flex-1 flex flex-col items-center">
          <Suspense
            fallback={
              <div className="w-full max-w-md h-96 rounded-lg bg-surface-2 animate-pulse" />
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </section>

        <footer className="relative z-10 mt-20 pt-8 border-t border-border-default/50 flex justify-between items-center">
          <p className="text-xs text-text-muted">
            PrepIQ Infrastructure &copy; 2026.
          </p>
          <div className="flex gap-6">
            <Link
              href="/terms"
              className="text-xs text-text-muted hover:text-text-primary"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-xs text-text-muted hover:text-text-primary"
            >
              Privacy
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
