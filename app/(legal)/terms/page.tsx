"use client";

import { AuthBrandAside } from "@/components/auth/auth-brand-aside";
import { AuthLogoRow } from "@/components/auth/auth-logo-row";
import { ArrowLeft } from "iconoir-react";
import Link from "next/link";

export default function TermsPage() {
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
            Terms and Conditions
          </h1>

          <div className="mt-8 space-y-6 text-text-secondary leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-text-primary mb-2">
                1. Introduction
              </h2>
              <p>
                Welcome to PrepIQ. By accessing or using our platform, you agree
                to be bound by these terms and conditions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text-primary mb-2">
                2. Use of Service
              </h2>
              <p>
                PrepIQ provides advanced kitchen command and compliance tools.
                You are responsible for maintaining the security of your account
                and all activities that occur under your credentials.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text-primary mb-2">
                3. Privacy
              </h2>
              <p>
                Your privacy is important to us. Please refer to our Privacy
                Policy for information on how we collect, use, and disclose your
                personal information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text-primary mb-2">
                4. Modifications
              </h2>
              <p>
                We reserve the right to modify these terms at any time.
                Continued use of the service after such modifications
                constitutes acceptance of the new terms.
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
