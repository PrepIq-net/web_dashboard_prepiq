"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Honeypot } from "@/components/auth/honeypot";
import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { useResendOtp, useVerifyOtp } from "@/services/users/hooks";
import { forgotPassword } from "@/services/users/service";

const RESEND_SECONDS = 60;

export function RecoveryVerifyForm() {
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
    <div className="w-full max-w-md space-y-12 animate-fade-in">
      <div className="space-y-3 text-center">
        <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-text-primary">
          Verify Code.
        </h1>
        <p className="text-lg text-text-secondary leading-relaxed mx-auto max-w-xs">
          Enter the security code sent to your email to reset your session.
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
            {verifyOtpMutation.isPending
              ? "Validating Signal..."
              : "Verify Recovery"}
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
        Wait, I remember it!{" "}
        <Link
          href="/login"
          className="font-semibold text-brand-gold hover:text-brand-gold-hover transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
