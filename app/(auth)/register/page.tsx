"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, EyeClosed, Lock, Mail, User } from "iconoir-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { AuthLogoRow } from "@/components/auth/auth-logo-row";
import { Honeypot } from "@/components/auth/honeypot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { useGoogleIdentity } from "@/lib/auth/use-google-identity";
import { useRegisterUser, useSessionGoogleLogin } from "@/services";
import { useTranslation } from "@/lib/i18n";

export default function RegisterPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [nickname, setNickname] = useState(""); // honeypot

  const registerMutation = useRegisterUser();
  const googleLoginMutation = useSessionGoogleLogin();

  const googleIdentity = useGoogleIdentity({
    onCredential: async (idToken) => {
      try {
        const result = await googleLoginMutation.mutateAsync({ id_token: idToken });
        toast.success(
          result.user.restored
            ? t("auth.accountReactivated")
            : t("auth.accountCreated"),
        );
        // Google emails arrive verified — no OTP step, straight to setup.
        router.replace("/");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("auth.googleFailed"));
      }
    },
    onError: (message) => toast.error(message),
  });

  function handleGoogleSignUp() {
    if (!googleIdentity.prompt()) {
      toast.error(t("auth.googleLoading"));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (nickname) return; // bot detected

    try {
      await registerMutation.mutateAsync({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        phone: phone.trim() || undefined,
      });
      toast.success(t("auth.accountCreated"));
      router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("auth.networkError"));
    }
  }

  return (
    <main className="min-h-screen bg-bg-base overflow-x-hidden">
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12 md:px-12 md:py-24">
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-brand-gold/5 blur-[120px]" />

        <header className="relative z-10 flex items-center justify-between mb-20">
          <AuthLogoRow size={48} />
        </header>

        <section className="relative z-10 flex-1 flex flex-col items-center">
          <div className="w-full max-w-2xl space-y-12 animate-fade-in">
            <div className="space-y-3 text-center">
              <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-text-primary">
                {t("auth.createAccountTitle")}
              </h1>
              <p className="text-lg text-text-secondary leading-relaxed max-w-lg mx-auto">
                {t("auth.createAccountSubtitle")}
              </p>
            </div>

            <form className="space-y-8" onSubmit={handleSubmit}>
              <Honeypot name="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} />

              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <Input
                  label={t("auth.firstName")}
                  type="text"
                  placeholder={t("auth.firstNamePlaceholder")}
                  leadingIcon={<User />}
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="text-lg"
                />
                <Input
                  label={t("auth.lastName")}
                  type="text"
                  placeholder={t("auth.lastNamePlaceholder")}
                  leadingIcon={<User />}
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="text-lg"
                />
              </div>

              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <Input
                  label={t("auth.workEmail")}
                  type="email"
                  placeholder={t("auth.emailPlaceholder")}
                  leadingIcon={<Mail />}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="text-lg"
                />
                <Input
                  label={t("auth.securePassword")}
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.passwordPlaceholder")}
                  leadingIcon={<Lock />}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="text-lg"
                  trailingIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="inline-flex items-center justify-center rounded-sm text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-gold"
                      aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                    >
                      {showPassword ? <EyeClosed /> : <Eye />}
                    </button>
                  }
                />
              </div>

              <PhoneInput label={t("auth.contactPhone")} value={phone} onChange={setPhone} className="text-lg" />

              <div className="py-4 border-y border-border-default/30">
                <p className="text-xs text-text-muted leading-relaxed text-center">
                  By clicking &ldquo;Create Account&rdquo; you agree to the PrepIQ{" "}
                  <Link href="/terms" className="text-brand-gold hover:underline">Terms of Service</Link> and{" "}
                  <Link href="/privacy" className="text-brand-gold hover:underline">Privacy Policy</Link>.
                </p>
              </div>

              <div className="space-y-6">
                <Button
                  type="submit"
                  fullWidth
                  disabled={registerMutation.isPending}
                  className="py-7 text-base font-semibold shadow-level-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  {registerMutation.isPending ? t("auth.creatingAccount") : t("auth.createAccountButton")}
                </Button>

                <div className="flex items-center gap-4 py-2">
                  <div className="h-px flex-1 bg-border-default/50" />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">{t("auth.orSignUpWith")}</span>
                  <div className="h-px flex-1 bg-border-default/50" />
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  className="py-7 border-border-default/50 hover:bg-surface-3 transition-all"
                  leftIcon={<Image src="/app_logo/logo-google.png" alt="Google" width={18} height={18} className="h-[18px] w-[18px]" />}
                  onClick={handleGoogleSignUp}
                  disabled={registerMutation.isPending || googleLoginMutation.isPending || !googleIdentity.configured}
                >
                  {googleLoginMutation.isPending ? t("auth.authenticating") : t("auth.continueWithGoogle")}
                </Button>
              </div>
            </form>

            <p className="text-center text-sm text-text-secondary pt-8">
              {t("auth.alreadyHaveAccount")}{" "}
              <Link href="/login" className="font-semibold text-brand-gold hover:text-brand-gold-hover transition-colors">
                {t("auth.signIn")}
              </Link>
            </p>
          </div>
        </section>

        <footer className="relative z-10 mt-20 pt-8 border-t border-border-default/50 flex justify-between items-center">
          <p className="text-xs text-text-muted">PrepIQ Infrastructure &copy; 2026.</p>
          <div className="flex gap-6">
            <Link href="/terms" className="text-xs text-text-muted hover:text-text-primary">Terms</Link>
            <Link href="/privacy" className="text-xs text-text-muted hover:text-text-primary">Privacy</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
