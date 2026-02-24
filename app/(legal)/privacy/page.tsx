"use client";

import { AuthBrandAside } from "@/components/auth/auth-brand-aside";
import { AuthLogoRow } from "@/components/auth/auth-logo-row";
import { ArrowLeft } from "iconoir-react";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="mx-auto grid min-h-screen w-full grid-cols-1 bg-surface-2 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
      <section className="flex min-h-screen flex-col items-center justify-center border-r border-border-default bg-surface-2 p-8 md:p-12">
        <div className="mx-auto w-full max-w-2xl">
          <AuthLogoRow size={64} />

          <Link
            href="/register"
            className="mt-8 flex items-center gap-2 text-sm text-text-muted hover:text-brand-gold transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to registration
          </Link>

          <h1 className="mt-8 font-display text-[40px] font-semibold leading-[48px] tracking-tight text-text-primary">
            Privacy Policy
          </h1>

          <div className="mt-8 space-y-6 text-text-secondary leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-text-primary mb-2">
                1. Data Collection
              </h2>
              <p>
                We collect information you provide directly to us, such as when
                you create an account, update your profile, or use our kitchen
                command tools.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text-primary mb-2">
                2. How We Use Data
              </h2>
              <p>
                We use the data we collect to provide, maintain, and improve our
                services, and to develop new tools for kitchen compliance and
                ESG metrics.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text-primary mb-2">
                3. Data Sharing
              </h2>
              <p>
                We do not share your personal information with third parties
                except as described in this policy or with your consent.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text-primary mb-2">
                4. Security
              </h2>
              <p>
                We take reasonable measures to help protect information about
                you from loss, theft, misuse, and unauthorized access.
              </p>
            </section>

            <p className="pt-8 text-sm text-text-muted">
              Last updated: May 2024
            </p>
          </div>
        </div>
      </section>
      <AuthBrandAside />
    </div>
  );
}
