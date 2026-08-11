"use client";

import Link from "next/link";
import { Mail, ArrowLeft } from "iconoir-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { Honeypot } from "@/components/auth/honeypot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForgotPassword } from "@/services";
import { useTranslation } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");

  const forgotPasswordMutation = useForgotPassword();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Honeypot check
    if (nickname) {
      console.log("Bot detected via honeypot.");
      return;
    }

    try {
      await forgotPasswordMutation.mutateAsync({ email });
      // We redirect regardless of the actual result to prevent user enumeration,
      // as confirmed by the backend implementation.
      const params = new URLSearchParams();
      params.set("email", email);
      toast.success(t("auth.recoveryEmailSent"));
      router.push(`/forgot-password/verify?${params.toString()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("auth.networkError"));
    }
  }

  return (
    <AuthSplitShell badgeLabelKey="auth.securityProtocol">
      <div className="w-full max-w-md space-y-12 animate-fade-in">
        <div className="space-y-3 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-text-primary">
            {t("auth.resetPasswordTitle")}
          </h1>
          <p className="text-lg text-text-secondary leading-relaxed">
            {t("auth.resetPasswordSubtitle")}
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
              label={t("auth.registeredEmail")}
              type="email"
              placeholder={t("auth.emailPlaceholder")}
              leadingIcon={<Mail />}
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="text-lg py-6"
            />
          </div>

          <div className="space-y-6 pt-2">
            <Button
              type="submit"
              fullWidth
              disabled={forgotPasswordMutation.isPending}
              className="py-7 text-base font-semibold shadow-level-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              {forgotPasswordMutation.isPending ? t("auth.sendingPulse") : t("auth.sendResetLink")}
            </Button>

            <Link
              href="/login"
              className="flex items-center justify-center gap-2 py-4 text-sm font-medium text-text-muted hover:text-brand-gold transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("auth.backToSignIn")}
            </Link>
          </div>
        </form>
      </div>
    </AuthSplitShell>
  );
}
