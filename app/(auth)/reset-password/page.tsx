"use client";

import { Eye, EyeClosed, Lock } from "iconoir-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthBrandAside } from "@/components/auth/auth-brand-aside";
import { AuthLogoRow } from "@/components/auth/auth-logo-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useResetPassword } from "@/services/users/hooks";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const otp = searchParams.get("otp") ?? "";

  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetPasswordMutation = useResetPassword();

  useEffect(() => {
    if (!email || !otp) {
      setErrorMessage("Invalid reset link. Please start the process again.");
    }
  }, [email, otp]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    try {
      await resetPasswordMutation.mutateAsync({
        email,
        otp,
        new_password: newPassword,
      });
      setSuccessMessage("Password reset successfully. Redirecting to login...");
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Reset failed. Please try again.",
      );
    }
  }

  return (
    <div className="mx-auto grid min-h-screen w-full grid-cols-1 bg-surface-2 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
      <section className="flex min-h-screen items-center justify-center border-r border-border-default bg-surface-2 p-8 md:p-12">
        <div className="mx-auto w-full max-w-lg">
          <AuthLogoRow size={64} />

          <h1 className="font-display text-[40px] font-semibold leading-[48px] tracking-tight text-text-primary">
            New Password
          </h1>
          <p className="mt-3 text-[14px] leading-[22px] text-text-secondary">
            Set a strong, unique password for your workspace access.
          </p>

          <form
            className="mt-10 rounded-card border border-border-default bg-surface-3 p-6 space-y-4"
            onSubmit={handleSubmit}
          >
            <Input
              label="New Password"
              type={showPassword ? "text" : "password"}
              placeholder="Min. 8 characters"
              leadingIcon={<Lock />}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
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
              label="Confirm Password"
              type={showPassword ? "text" : "password"}
              placeholder="Confirm your password"
              leadingIcon={<Lock />}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
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
              disabled={resetPasswordMutation.isPending || !email || !otp}
            >
              {resetPasswordMutation.isPending
                ? "Updating..."
                : "Reset Password"}
            </Button>
          </form>
        </div>
      </section>
      <AuthBrandAside />
    </div>
  );
}
