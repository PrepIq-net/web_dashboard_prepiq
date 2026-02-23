"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, EyeClosed, GoogleCircle, Lock, Mail } from "iconoir-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="grid min-h-screen w-full grid-cols-1 bg-surface-2 lg:grid-cols-[minmax(0,620px)_minmax(0,1fr)]">
      <section className="flex min-h-screen items-center justify-center border-r border-border-default bg-surface-2 p-8 md:p-12">
        <div className="mx-auto w-full max-w-lg">
          <div className="mb-10 flex items-center gap-3">
            <Image
              src="/logo/golden-main-transparent.png"
              alt="PrepIQ logo"
              width={52}
              height={52}
              className="h-13 w-13"
              priority
            />
            <span className="font-display text-2xl font-semibold tracking-tight text-text-primary">
              PrepIQ
            </span>
          </div>

          <h1 className="font-display text-[40px] font-semibold leading-[48px] tracking-tight text-text-primary">
            Welcome Back
          </h1>
          <p className="mt-3 text-[14px] leading-[22px] text-text-secondary">
            Sign in to access your kitchen command layer.
          </p>

          <form className="mt-10 rounded-card border border-border-default bg-surface-3 p-6 space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="Enter your email"
              leadingIcon={<Mail />}
              autoComplete="email"
            />
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              leadingIcon={<Lock />}
              autoComplete="current-password"
              trailingIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="inline-flex items-center justify-center rounded-sm text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-gold"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeClosed /> : <Eye />}
                </button>
              }
            />

            <div className="flex items-center justify-between pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded-[4px] border border-border-default bg-surface-2 accent-[var(--color-brand-gold)]"
                />
                Remember me
              </label>
              <Link href="#" className="text-xs text-brand-gold hover:text-brand-gold-hover">
                Forgot password?
              </Link>
            </div>

            <Button type="button" fullWidth>
              Sign In
            </Button>

            <div className="flex items-center gap-3 py-2">
              <div className="h-px flex-1 bg-border-default" />
              <span className="text-xs uppercase tracking-[0.18em] text-text-muted">or</span>
              <div className="h-px flex-1 bg-border-default" />
            </div>

            <Button type="button" variant="secondary" fullWidth leftIcon={<GoogleCircle />}>
              Continue with Google
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Not registered yet?{" "}
            <Link href="#" className="font-medium text-brand-gold hover:text-brand-gold-hover">
              Create an account
            </Link>
          </p>
        </div>
      </section>

      <aside className="relative hidden min-h-screen bg-surface-3 p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(168,130,31,0.2),transparent_45%),radial-gradient(circle_at_10%_100%,rgba(58,110,165,0.2),transparent_48%)]" />

        <div className="relative z-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-gold">
            Kitchen Intelligence
          </p>
          <h2 className="mt-5 font-display text-[40px] font-semibold leading-[48px] tracking-tight text-text-primary">
            Control margin variance before service starts.
          </h2>
          <p className="mt-6 max-w-xl text-[16px] leading-[24px] text-text-secondary">
            PrepIQ translates prep activity into financial signal. Detect leakage,
            assign ownership, and execute corrective actions by the next shift.
          </p>
        </div>

        <div className="relative z-10 rounded-card border border-border-default bg-surface-2/70 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
            Daily Discipline
          </p>
          <p className="mt-3 text-[14px] leading-[22px] text-text-secondary">
            "Production delta flagged at +12%. Recommended action issued before opening."
          </p>
        </div>
      </aside>
    </div>
  );
}
