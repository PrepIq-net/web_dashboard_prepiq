"use client";

import Link from "next/link";
import { Mail, ArrowLeft } from "iconoir-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthBrandAside } from "@/components/auth/auth-brand-aside";
import { AuthLogoRow } from "@/components/auth/auth-logo-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForgotPassword } from "@/services/users/hooks";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const forgotPasswordMutation = useForgotPassword();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await forgotPasswordMutation.mutateAsync({ email });
      // We redirect regardless of the actual result to prevent user enumeration,
      // as confirmed by the backend implementation.
      const params = new URLSearchParams();
      params.set("email", email);
      params.set("context", "password_reset");
      router.push(`/verify-otp?${params.toString()}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
      );
    }
  }

  return (
    <div className="mx-auto grid min-h-screen w-full grid-cols-1 bg-surface-2 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
      <section className="flex min-h-screen items-center justify-center border-r border-border-default bg-surface-2 p-8 md:p-12">
        <div className="mx-auto w-full max-w-lg">
          <AuthLogoRow size={64} />

          <h1 className="font-display text-[40px] font-semibold leading-[48px] tracking-tight text-text-primary">
            Reset Password
          </h1>
          <p className="mt-3 text-[14px] leading-[22px] text-text-secondary">
            Enter your email to receive recovery instructions.
          </p>

          <form
            className="mt-10 rounded-card border border-border-default bg-surface-3 p-6 space-y-4"
            onSubmit={handleSubmit}
          >
            <Input
              label="Email"
              type="email"
              placeholder="Enter your email"
              leadingIcon={<Mail />}
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            {successMessage ? (
              <p className="text-sm text-status-success">{successMessage}</p>
            ) : null}

            {errorMessage ? (
              <p className="text-sm text-status-critical">{errorMessage}</p>
            ) : null}

            <Button
              type="submit"
              fullWidth
              disabled={forgotPasswordMutation.isPending}
            >
              {forgotPasswordMutation.isPending
                ? "Sending Link..."
                : "Send Reset Link"}
            </Button>

            <Link
              href="/login"
              className="flex items-center justify-center gap-2 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sign In
            </Link>
          </form>
        </div>
      </section>
      <AuthBrandAside />
    </div>
  );
}
