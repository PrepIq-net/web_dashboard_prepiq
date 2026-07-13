"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, EyeClosed, Lock, Mail } from "iconoir-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Honeypot } from "@/components/auth/honeypot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/errors";
import { useGoogleIdentity } from "@/lib/auth/use-google-identity";
import { useSessionGoogleLogin, useSessionLoginUser } from "@/services";
import { useTranslation } from "@/lib/i18n";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState(""); // Honeypot field
  const [isUnverified, setIsUnverified] = useState(false);
  const [isSessionSwitching, setIsSessionSwitching] = useState(false);

  const loginMutation = useSessionLoginUser();
  const googleLoginMutation = useSessionGoogleLogin();
  const { t } = useTranslation();

  const isBusy = useMemo(
    () => loginMutation.isPending || googleLoginMutation.isPending || isSessionSwitching,
    [loginMutation.isPending, googleLoginMutation.isPending, isSessionSwitching],
  );

  useEffect(() => {
    const redirectEmail = searchParams.get("email");
    const verified = searchParams.get("verified");

    if (redirectEmail) {
      setEmail(redirectEmail);
    }

    if (verified === "1") {
      toast.success(t("auth.otpVerified"));
      const params = new URLSearchParams(searchParams.toString());
      params.delete("verified");
      router.replace(`/login${params.toString() ? `?${params.toString()}` : ""}`, {
        scroll: false,
      });
    }
    // `t` is intentionally omitted: useTranslation() returns a new `t` reference
    // on every render, which would re-run this effect (and re-toast) on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router]);

  const googleIdentity = useGoogleIdentity({
    onCredential: async (idToken) => {
      try {
        const result = await googleLoginMutation.mutateAsync({
          id_token: idToken,
        });
        setIsSessionSwitching(true);
        toast.success(
          result.user.restored
            ? t("auth.accountReactivated")
            : t("auth.sessionSwitched"),
        );
        router.replace("/");
        router.refresh();
      } catch (error) {
        setIsSessionSwitching(false);
        toast.error(
          error instanceof Error ? error.message : t("auth.googleFailed"),
        );
      }
    },
    onError: (message) => toast.error(message),
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Honeypot check
    if (nickname) {
      console.log("Bot detected via honeypot.");
      return;
    }

    setIsUnverified(false);

    try {
      await loginMutation.mutateAsync({ email, password });
      setIsSessionSwitching(true);
      toast.success(t("auth.sessionSwitched"));
      router.replace("/");
      router.refresh();
    } catch (error) {
      setIsSessionSwitching(false);
      const details = error instanceof ApiError ? (error.details as any) : null;

      // Robust error code extraction
      const errorCode = details?.error?.details?.code?.[0] || details?.code;

      console.log("Login Error Debug:", {
        details,
        errorCode,
        isApiError: error instanceof ApiError,
      });

      if (errorCode === "USER_NOT_VERIFIED") {
        setIsUnverified(true);
        toast.error("Account not verified.");
        return;
      }

      toast.error(
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
      );
    }
  }

  function handleGoogleSignIn() {
    if (!googleIdentity.prompt()) {
      toast.error(t("auth.googleLoading"));
    }
  }

  return (
    <div className="relative w-full max-w-md space-y-12 animate-fade-in">
      {isSessionSwitching ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl border border-surface-4 bg-surface-1/95 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
            <p className="text-sm font-medium text-text-secondary">
              {t("auth.sessionSwitched")}
            </p>
          </div>
        </div>
      ) : null}
      <div className="space-y-3 text-center">
        <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-text-primary">
          {t("auth.welcomeBack")}
        </h1>
        <p className="text-lg text-text-secondary leading-relaxed">
          {t("auth.loginSubtitle")}
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
            label={t("auth.email")}
            type="email"
            placeholder={t("auth.emailPlaceholder")}
            leadingIcon={<Mail />}
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setIsUnverified(false);
            }}
            required
            className="text-lg"
          />
          <Input
            label={t("auth.password")}
            type={showPassword ? "text" : "password"}
            placeholder={t("auth.passwordPlaceholder")}
            leadingIcon={<Lock />}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="text-lg"
            trailingIcon={
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="inline-flex items-center justify-center rounded-sm text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-gold"
                aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              >
                {showPassword ? <EyeClosed /> : <Eye />}
              </button>
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-sm text-text-secondary cursor-pointer group">
            <input
              type="checkbox"
              className="h-4 w-4 rounded-[4px] border border-border-default bg-surface-2 accent-brand-gold cursor-pointer transition-colors group-hover:border-brand-gold/50"
            />
            {t("auth.rememberMe")}
          </label>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-brand-gold hover:text-brand-gold-hover transition-colors"
          >
            {t("auth.forgotPassword")}
          </Link>
        </div>

        <div className="space-y-6 pt-2">
          <Button
            type="submit"
            fullWidth
            disabled={isBusy}
            className="py-7 text-base font-semibold shadow-level-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            {loginMutation.isPending ? t("auth.authenticating") : t("auth.signIn")}
          </Button>

          {isUnverified && (
            <div className="rounded-card border border-brand-gold/20 bg-brand-gold/5 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <p className="text-xs leading-relaxed text-text-secondary text-center">
                {t("auth.unverifiedMessage")}{" "}
                <Link
                  href={`/verify-otp?email=${encodeURIComponent(email)}`}
                  className="font-semibold text-brand-gold hover:underline"
                >
                  {t("auth.verifyEmail")}
                </Link>
                .
              </p>
            </div>
          )}

          <div className="flex items-center gap-4 py-2">
            <div className="h-px flex-1 bg-border-default/50" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">
              {t("auth.orSignInWith")}
            </span>
            <div className="h-px flex-1 bg-border-default/50" />
          </div>

          <Button
            type="button"
            variant="secondary"
            fullWidth
            className="py-7 border-border-default/50 hover:bg-surface-3 transition-all"
            leftIcon={
              <Image
                src="/app_logo/logo-google.png"
                alt="Google"
                width={18}
                height={18}
                className="h-[18px] w-[18px]"
              />
            }
            onClick={handleGoogleSignIn}
            disabled={isBusy || !googleIdentity.configured}
          >
            {googleLoginMutation.isPending
              ? t("common.loading")
              : t("auth.continueWithGoogle")}
          </Button>
        </div>
      </form>

      <p className="text-center text-sm text-text-secondary pt-8">
        {t("auth.newToPlatform")}{" "}
        <Link
          href="/register"
          className="font-semibold text-brand-gold hover:text-brand-gold-hover transition-colors"
        >
          {t("auth.createAccount")}
        </Link>
      </p>
    </div>
  );
}
