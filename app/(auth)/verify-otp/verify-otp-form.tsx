"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Honeypot } from "@/components/auth/honeypot";
import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { useResendOtp, useVerifyOtp } from "@/services";

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

export function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [otp, setOtp] = useState("");
  const [nickname, setNickname] = useState(""); // Honeypot field
  const [resendCountdown, setResendCountdown] = useState(RESEND_SECONDS);

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
      toast.error("Missing email context. Please register again.");
      return;
    }

    try {
      await resendOtpMutation.mutateAsync({ email });
      setResendCountdown(RESEND_SECONDS);
      toast.success("A new OTP has been sent.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to resend OTP.",
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

    if (!email) {
      toast.error("Missing email context. Please register again.");
      return;
    }

    if (!isOtpComplete) {
      toast.error("Enter all 6 digits.");
      return;
    }

    try {
      await verifyOtpMutation.mutateAsync({ email, otp });
      toast.success("Account verified successfully.");
      router.push(`/login?email=${encodeURIComponent(email)}&verified=1`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "OTP verification failed.",
      );
    }
  }

  return (
    <div className="w-full max-w-md space-y-12 animate-fade-in">
      <div className="space-y-3 text-center">
        <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-text-primary">
          Verify Email.
        </h1>
        <p className="text-lg text-text-secondary leading-relaxed">
          Enter the 6-digit code sent to{" "}
          <span className="font-medium text-text-primary">
            {email ? maskEmail(email) : "your email"}
          </span>
          .
        </p>
      </div>

      <form className="space-y-10" onSubmit={handleVerify}>
        <Honeypot
          name="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />

        <div className="flex justify-center">
          <OtpInput value={otp} onChange={setOtp} />
        </div>

        <div className="space-y-6">
          <Button
            type="submit"
            fullWidth
            disabled={!isOtpComplete || verifyOtpMutation.isPending}
            className="py-7 text-base font-semibold shadow-level-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            {verifyOtpMutation.isPending ? "Verifying..." : "Verify Email"}
          </Button>

          <div className="flex flex-col items-center gap-4 text-sm">
            <p className="text-text-muted italic">
              Didn&apos;t receive a code?
            </p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCountdown > 0 || resendOtpMutation.isPending}
              className="font-semibold text-brand-gold transition-all hover:text-brand-gold-hover disabled:cursor-not-allowed disabled:text-text-disabled py-2 px-4 rounded-button hover:bg-brand-gold/5"
            >
              {resendLabel}
            </button>
          </div>
        </div>
      </form>

      <p className="text-center text-sm text-text-secondary pt-8">
        Wrong email?{" "}
        <Link
          href="/register"
          className="font-semibold text-brand-gold hover:text-brand-gold-hover transition-colors"
        >
          Create new account
        </Link>
      </p>
    </div>
  );
}
