"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { AuthBrandAside } from "@/components/auth/auth-brand-aside";
import { AuthLogoRow } from "@/components/auth/auth-logo-row";
import { Honeypot } from "@/components/auth/honeypot";
import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { useResendOtp, useVerifyOtp } from "@/services/users/hooks";
import { forgotPassword } from "@/services/users/service";

const RESEND_SECONDS = 60;

export default function RecoveryVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [otp, setOtp] = useState("");
  const [nickname, setNickname] = useState(""); // Honeypot field
  const [resendCountdown, setResendCountdown] = useState(RESEND_SECONDS);

  const isOtpComplete = useMemo(() => otp.length === 6, [otp]);
  const verifyOtpMutation = useVerifyOtp();
  const resendOtpMutation = useResendOtp();

  useEffect(() => {
    if (resendCountdown === 0) return;
    const timer = window.setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCountdown]);

  const resendLabel = useMemo(() => {
    if (resendOtpMutation.isPending) return "Resending...";
    if (resendCountdown > 0) return `Resend in ${resendCountdown}s`;
    return "Resend code";
  }, [resendCountdown, resendOtpMutation.isPending]);

  async function handleResend() {
    if (!email) {
      toast.error("Invalid session. Please start over.");
      return;
    }
    try {
      await forgotPassword({ email });
      setResendCountdown(RESEND_SECONDS);
      toast.success("A new verification code has been sent.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to resend code.",
      );
    }
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Honeypot check
    if (nickname) {
      console.log("Bot detected via honeypot.");
      return;
    }

    if (!email || !isOtpComplete) {
      toast.error("Please enter the 6-digit code.");
      return;
    }

    try {
      await verifyOtpMutation.mutateAsync({
        email,
        otp,
        context: "password_reset",
      });

      toast.success("Code verified.");
      router.push(
        `/reset-password?email=${encodeURIComponent(email)}&otp=${encodeURIComponent(otp)}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid code.");
    }
  }

  return (
    <div className="mx-auto grid min-h-screen w-full grid-cols-1 bg-surface-2 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
      <section className="flex min-h-screen items-center justify-center border-r border-border-default bg-surface-2 p-8 md:p-12">
        <div className="mx-auto w-full max-w-lg">
          <AuthLogoRow size={64} />

          <h1 className="font-display text-[40px] font-semibold leading-[48px] tracking-tight text-text-primary">
            Verify Recovery Code
          </h1>
          <p className="mt-3 text-[14px] leading-[22px] text-text-secondary">
            Enter the code sent to your email to securely reset your password.
          </p>

          <form
            className="mt-10 rounded-card border border-border-default bg-surface-3 p-6 space-y-6"
            onSubmit={handleVerify}
          >
            <Honeypot
              name="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
            <OtpInput value={otp} onChange={setOtp} />

            <Button
              type="submit"
              fullWidth
              disabled={!isOtpComplete || verifyOtpMutation.isPending}
            >
              {verifyOtpMutation.isPending ? "Verifying..." : "Continue"}
            </Button>

            <div className="flex items-center justify-between border-t border-border-default pt-4 text-sm text-text-secondary">
              <span>Didn't receive a code?</span>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCountdown > 0 || resendOtpMutation.isPending}
                className="font-medium text-brand-gold transition-colors hover:text-brand-gold-hover disabled:cursor-not-allowed disabled:text-text-disabled cursor-pointer"
              >
                {resendLabel}
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Wait, I remember it!{" "}
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
