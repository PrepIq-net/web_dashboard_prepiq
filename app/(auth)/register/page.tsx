"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Eye,
  EyeClosed,
  Lock,
  Mail,
  Phone,
  User,
  UserBag,
} from "iconoir-react";
import { useState } from "react";
import { AuthBrandAside } from "@/components/auth/auth-brand-aside";
import { AuthLogoRow } from "@/components/auth/auth-logo-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="mx-auto grid min-h-screen w-full grid-cols-1 bg-surface-2 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
      <section className="flex min-h-screen items-center justify-center border-r border-border-default bg-surface-2 p-8 md:p-12">
        <div className="mx-auto w-full max-w-lg">
          <AuthLogoRow size={64} />

          <h1 className="font-display text-[40px] font-semibold leading-[48px] tracking-tight text-text-primary">
            Create Account
          </h1>
          <p className="mt-3 text-[14px] leading-[22px] text-text-secondary">
            Set up your workspace access with your core profile details.
          </p>

          <form className="mt-10 rounded-card border border-border-default bg-surface-3 p-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="First Name"
                type="text"
                placeholder="First name"
                leadingIcon={<User />}
                autoComplete="given-name"
                required
              />
              <Input
                label="Last Name"
                type="text"
                placeholder="Last name"
                leadingIcon={<User />}
                autoComplete="family-name"
                required
              />
            </div>

            <Input
              label="Email"
              type="email"
              placeholder="Enter your email"
              leadingIcon={<Mail />}
              autoComplete="email"
              required
            />

            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="Create password"
              leadingIcon={<Lock />}
              autoComplete="new-password"
              required
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Phone"
                type="tel"
                placeholder="Optional"
                leadingIcon={<Phone />}
                autoComplete="tel"
              />
              <Input
                label="Job Title"
                type="text"
                placeholder="Optional"
                leadingIcon={<UserBag />}
                autoComplete="organization-title"
              />
            </div>

            <Button type="submit" fullWidth>
              Create Account
            </Button>

            <div className="flex items-center gap-3 py-2">
              <div className="h-px flex-1 bg-border-default" />
              <span className="text-xs uppercase tracking-[0.18em] text-text-muted">
                or
              </span>
              <div className="h-px flex-1 bg-border-default" />
            </div>

            <Button
              type="button"
              variant="secondary"
              fullWidth
              leftIcon={
                <Image
                  src="/app_logo/logo-google.png"
                  alt="Google"
                  width={18}
                  height={18}
                  className="h-[18px] w-[18px]"
                />
              }
            >
              Continue with Google
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-brand-gold hover:text-brand-gold-hover"
            >
              Sign in
            </Link>
          </p>
        </div>
      </section>

      <AuthBrandAside />
    </div>
  );
}
