"use client";

import Link from "next/link";
import { Eye, EyeClosed, Lock } from "iconoir-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { AuthLogoRow } from "@/components/auth/auth-logo-row";
import { Honeypot } from "@/components/auth/honeypot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useResetPassword } from "@/services";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const otp = searchParams.get("otp") ?? "";

  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nickname, setNickname] = useState(""); // Honeypot field

  const resetPasswordMutation = useResetPassword();

  useEffect(() => {
    if (!email || !otp) {
      toast.error("Invalid reset link. Please start the process again.");
    }
  }, [email, otp]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Honeypot check
    if (nickname) {
      console.log("Bot detected via honeypot.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    try {
      await resetPasswordMutation.mutateAsync({
        email,
        otp,
        new_password: newPassword,
      });
      toast.success("Password reset successfully. Redirecting to login...");
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Reset failed. Please try again.",
      );
    }
  }

  return (
    <main className="min-h-screen bg-bg-base overflow-x-hidden">
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12 md:px-12 md:py-24">
        {/* Background glow for a "pro" feel */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-brand-gold/5 blur-[120px]" />

        <header className="relative z-10 flex items-center justify-between mb-20">
          <AuthLogoRow size={48} />
          <div className="hidden md:block">
            <p className="text-sm font-medium text-text-muted">
              Security Protocol
            </p>
          </div>
        </header>

        <section className="relative z-10 flex-1 flex flex-col items-center">
          <div className="w-full max-w-md space-y-12 animate-fade-in">
            <div className="space-y-3 text-center">
              <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-text-primary">
                New Identity.
              </h1>
              <p className="text-lg text-text-secondary leading-relaxed">
                Set a strong, unique password for your workspace access.
              </p>
            </div>

            <form className="space-y-8" onSubmit={handleSubmit}>
              <Honeypot
                name="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />

              <div className="space-y-6">
                <Input
                  label="New Password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  leadingIcon={<Lock />}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  className="text-lg py-6"
                  trailingIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="inline-flex items-center justify-center rounded-sm text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-gold"
                    >
                      {showPassword ? <EyeClosed /> : <Eye />}
                    </button>
                  }
                />

                <Input
                  label="Confirm Identity"
                  type={showPassword ? "text" : "password"}
                  placeholder="Re-enter password"
                  leadingIcon={<Lock />}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  className="text-lg py-6"
                />
              </div>

              <div className="space-y-6 pt-2">
                <Button
                  type="submit"
                  fullWidth
                  disabled={resetPasswordMutation.isPending || !email || !otp}
                  className="py-7 text-base font-semibold shadow-level-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  {resetPasswordMutation.isPending
                    ? "Updating Identity..."
                    : "Finalize Reset"}
                </Button>
              </div>
            </form>
          </div>
        </section>

        <footer className="relative z-10 mt-20 pt-8 border-t border-border-default/50 flex justify-between items-center">
          <p className="text-xs text-text-muted">
            PrepIQ Infrastructure &copy; 2026.
          </p>
          <div className="flex gap-6">
            <Link
              href="/terms"
              className="text-xs text-text-muted hover:text-text-primary"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-xs text-text-muted hover:text-text-primary"
            >
              Privacy
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
