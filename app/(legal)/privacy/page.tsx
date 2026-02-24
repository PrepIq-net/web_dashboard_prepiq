"use client";

import { AuthLogoRow } from "@/components/auth/auth-logo-row";
import { ArrowLeft } from "iconoir-react";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-bg-base overflow-x-hidden text-text-primary">
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12 md:px-12 md:py-24">
        {/* Background glow for a "pro" feel */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-brand-gold/5 blur-[120px]" />

        <header className="relative z-10 flex items-center justify-between mb-20">
          <AuthLogoRow size={48} />
          <div className="hidden md:block">
            <p className="text-sm font-medium text-text-muted italic">
              Legal Framework
            </p>
          </div>
        </header>

        <section className="relative z-10 flex-1 flex flex-col items-center">
          <div className="w-full max-w-2xl space-y-16 animate-fade-in">
            <div className="space-y-6">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-gold hover:text-brand-gold-hover transition-colors group"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Return to Access
              </Link>
              <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-text-primary">
                Privacy Policy.
              </h1>
              <p className="text-lg text-text-secondary leading-relaxed">
                We believe in total transparency regarding your organizational
                data and how it helps us optimize your kitchen environment.
              </p>
            </div>

            <div className="space-y-12 text-text-secondary leading-relaxed">
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-text-primary">
                  1. Data Collection
                </h2>
                <div className="h-0.5 w-12 bg-brand-gold/30 rounded-full" />
                <p className="text-lg">
                  We collect information you provide directly to us, such as
                  when you create an account, update your profile, or use our
                  kitchen command tools. This is essential for building your
                  intelligence layer.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-text-primary">
                  2. How We Use Data
                </h2>
                <div className="h-0.5 w-12 bg-brand-gold/30 rounded-full" />
                <p className="text-lg">
                  We use the data we collect to provide, maintain, and improve
                  our services, and to develop new tools for kitchen compliance
                  and ESG metrics that matter to your bottom line.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-text-primary">
                  3. Data Sharing
                </h2>
                <div className="h-0.5 w-12 bg-brand-gold/30 rounded-full" />
                <p className="text-lg">
                  We do not share your personal information with third parties
                  except as described in this policy or with your explicit
                  consent. Your data is your property.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-text-primary">
                  4. Security
                </h2>
                <div className="h-0.5 w-12 bg-brand-gold/30 rounded-full" />
                <p className="text-lg">
                  We take reasonable measures to help protect information about
                  you from loss, theft, misuse, and unauthorized access. We use
                  enterprise-grade encryption.
                </p>
              </section>

              <p className="pt-8 text-sm font-medium text-text-muted uppercase tracking-widest border-t border-border-default/50">
                Protocol Revision:{" "}
                {new Date().toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
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
              className="text-xs text-text-muted hover:text-text-primary font-semibold text-text-primary"
            >
              Privacy
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
