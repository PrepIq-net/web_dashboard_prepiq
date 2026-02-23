"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AuthBrandAside } from "@/components/auth/auth-brand-aside";
import { AuthLogoRow } from "@/components/auth/auth-logo-row";
import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";

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
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [otp, setOtp] = useState("");
  const [resendCountdown, setResendCountdown] = useState(RESEND_SECONDS);

  const isOtpComplete = useMemo(() => otp.length === 6, [otp]);

  useEffect(() => {
    if (resendCountdown === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCountdown]);

  function handleResend() {
    setResendCountdown(RESEND_SECONDS);
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

          <form className="mt-10 rounded-card border border-border-default bg-surface-3 p-6 space-y-6">
            <OtpInput value={otp} onChange={setOtp} />

            <Button type="submit" fullWidth disabled={!isOtpComplete}>
              Verify Code
            </Button>

            <div className="flex items-center justify-between border-t border-border-default pt-4 text-sm text-text-secondary">
              <span>Didn't receive a code?</span>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCountdown > 0}
                className="font-medium text-brand-gold transition-colors hover:text-brand-gold-hover disabled:cursor-not-allowed disabled:text-text-disabled"
              >
                {resendCountdown > 0
                  ? `Resend in ${resendCountdown}s`
                  : "Resend OTP"}
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
