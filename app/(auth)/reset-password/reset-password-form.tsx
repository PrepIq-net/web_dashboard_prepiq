"use client";

import Link from "next/link";
import { Eye, EyeClosed, Lock } from "iconoir-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Honeypot } from "@/components/auth/honeypot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useResetPassword } from "@/services";
import { useTranslation } from "@/lib/i18n";

export function ResetPasswordForm() {
  const { t } = useTranslation();
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
      toast.error(t("auth.invalidResetLink"));
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
      toast.error(t("auth.resetPasswordsMismatch"));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t("auth.resetPasswordTooShort"));
      return;
    }
    try {
      await resetPasswordMutation.mutateAsync({ email, otp, new_password: newPassword });
      toast.success(t("auth.passwordResetSuccess"));
      setTimeout(() => router.push("/login"), 2000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("auth.resetFailed"));
    }
  }

  return (
    <div className="w-full max-w-md space-y-12 animate-fade-in">
      <div className="space-y-3 text-center">
        <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-text-primary">
          {t("auth.newIdentityTitle")}
        </h1>
        <p className="text-lg text-text-secondary leading-relaxed">
          {t("auth.newIdentitySubtitle")}
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
            label={t("auth.newPassword")}
            type={showPassword ? "text" : "password"}
            placeholder={t("auth.minChars")}
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
            label={t("auth.confirmIdentity")}
            type={showPassword ? "text" : "password"}
            placeholder={t("auth.reenterPassword")}
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
            {resetPasswordMutation.isPending ? t("auth.updatingIdentity") : t("auth.finalizeReset")}
          </Button>
        </div>
      </form>
    </div>
  );
}
