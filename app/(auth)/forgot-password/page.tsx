"use client";

import Link from "next/link";
import { Mail, ArrowLeft } from "iconoir-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { AuthLogoRow } from "@/components/auth/auth-logo-row";
import { Honeypot } from "@/components/auth/honeypot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForgotPassword } from "@/services";
import { useTranslation } from "@/lib/i18n";
import { AuthHeaderBadge } from "@/components/auth/auth-header-badge";
import { AuthFooter } from "@/components/auth/auth-footer";

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
    <main className="min-h-screen bg-bg-base overflow-x-hidden">
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12 md:px-12 md:py-24">
        {/* Background glow for a "pro" feel */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-brand-gold/5 blur-[120px]" />

        <header className="relative z-10 flex items-center justify-between mb-20">
          <AuthLogoRow size={48} />
          <AuthHeaderBadge labelKey="auth.securityProtocol" />
        </header>

        <section className="relative z-10 flex-1 flex flex-col items-center">
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
        </section>

        <AuthFooter />
      </div>
    </main>
  );
}
