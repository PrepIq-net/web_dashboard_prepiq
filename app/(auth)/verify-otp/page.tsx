"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AuthBrandAside } from "@/components/auth/auth-brand-aside";
import { AuthLogoRow } from "@/components/auth/auth-logo-row";
import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { useResendOtp, useVerifyOtp } from "@/services/users/hooks";

const RESEND_SECONDS = 60;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) {
    return email;
  }

  if (local.length <= 2) {
    return `${local[0] ?? ""}***@${domain}`;
  }

  return `${local.slice(0, 2)}***@${domain}`;
}

export default function VerifyOtpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [otp, setOtp] = useState("");
  const [resendCountdown, setResendCountdown] = useState(RESEND_SECONDS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isOtpComplete = useMemo(() => otp.length === 6, [otp]);
  const verifyOtpMutation = useVerifyOtp();
  const resendOtpMutation = useResendOtp();
  const resendLabel = useMemo(() => {
    if (resendOtpMutation.isPending) {
      return "Resending...";
    }
    if (resendCountdown > 0) {
      return `Resend in ${resendCountdown}s`;
    }
    return "Resend OTP";
  }, [resendCountdown, resendOtpMutation.isPending]);

  useEffect(() => {
    if (resendCountdown === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCountdown]);

  async function handleResend() {
    if (!email) {
      setErrorMessage("Missing email context. Please register or login again.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await resendOtpMutation.mutateAsync({ email });
      setResendCountdown(RESEND_SECONDS);
      setSuccessMessage("A new OTP has been sent.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to resend OTP.",
      );
    }
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email) {
      setErrorMessage("Missing email context. Please register or login again.");
      return;
    }

    if (!isOtpComplete) {
      setErrorMessage("Enter all 6 digits.");
      return;
    }

    try {
      await verifyOtpMutation.mutateAsync({ email, otp });
      router.push(`/login?email=${encodeURIComponent(email)}&verified=1`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "OTP verification failed.",
      );
    }
  }

  return (
    <div className="mx-auto grid min-h-screen w-full grid-cols-1 bg-surface-2 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
      <section className="flex min-h-screen items-center justify-center border-r border-border-default bg-surface-2 p-8 md:p-12">
        <div className="mx-auto w-full max-w-lg">
          <AuthLogoRow size={64} />

          <h1 className="font-display text-[40px] font-semibold leading-[48px] tracking-tight text-text-primary">
            Verify OTP
          </h1>
          <p className="mt-3 text-[14px] leading-[22px] text-text-secondary">
            Enter the 6-digit code sent to{" "}
            {email ? (
              <span className="text-text-primary">{maskEmail(email)}</span>
            ) : (
              "your email"
            )}
            .
          </p>

          <form
            className="mt-10 rounded-card border border-border-default bg-surface-3 p-6 space-y-6"
            onSubmit={handleVerify}
          >
            <OtpInput value={otp} onChange={setOtp} />

            {successMessage ? (
              <p className="text-sm text-status-success">{successMessage}</p>
            ) : null}
            {errorMessage ? (
              <p className="text-sm text-status-critical">{errorMessage}</p>
            ) : null}

            <Button
              type="submit"
              fullWidth
              disabled={!isOtpComplete || verifyOtpMutation.isPending}
            >
              {verifyOtpMutation.isPending ? "Verifying..." : "Verify Code"}
            </Button>

            <div className="flex items-center justify-between border-t border-border-default pt-4 text-sm text-text-secondary">
              <span>Didn't receive a code?</span>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCountdown > 0 || resendOtpMutation.isPending}
                className="font-medium text-brand-gold transition-colors hover:text-brand-gold-hover disabled:cursor-not-allowed disabled:text-text-disabled"
              >
                {resendLabel}
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Entered the wrong email?{" "}
            <Link
              href="/register"
              className="font-medium text-brand-gold hover:text-brand-gold-hover"
            >
              Go back
            </Link>
          </p>
        </div>
      </section>

      <AuthBrandAside />
    </div>
  );
}
