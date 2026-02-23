"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, EyeClosed, Lock, Mail } from "iconoir-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useSessionGoogleLogin,
  useSessionLoginUser,
} from "@/services/users/hooks";

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleAccounts = {
  id: {
    initialize: (options: {
      client_id: string;
      callback: (response: GoogleCredentialResponse) => void;
      auto_select?: boolean;
      use_fedcm_for_prompt?: boolean;
    }) => void;
    prompt: () => void;
  };
};

type GoogleWindow = Window & {
  google?: {
    accounts?: GoogleAccounts;
  };
};

function GoogleColorMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#EA4335"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.86 2.7-6.62Z"
      />
      <path
        fill="#4285F4"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3-2.33Z"
      />
      <path
        fill="#34A853"
        d="M9 3.58c1.32 0 2.5.45 3.43 1.34l2.58-2.58A8.97 8.97 0 0 0 9 0a9 9 0 0 0-8.04 4.96l3 2.33c.71-2.13 2.69-3.71 5.04-3.71Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [googleReady, setGoogleReady] = useState(false);

  const loginMutation = useSessionLoginUser();
  const googleLoginMutation = useSessionGoogleLogin();

  const isBusy = useMemo(
    () => loginMutation.isPending || googleLoginMutation.isPending,
    [loginMutation.isPending, googleLoginMutation.isPending],
  );

  useEffect(() => {
    let active = true;

    async function loadGoogleConfig() {
      try {
        const response = await fetch("/api/auth/google/config", {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          clientId?: string;
          message?: string;
        };

        if (!response.ok || !payload.clientId) {
          throw new Error(
            payload.message ?? "Google sign-in is not configured.",
          );
        }

        if (active) {
          setGoogleClientId(payload.clientId);
        }
      } catch (error) {
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to initialize Google login.",
          );
        }
      }
    }

    loadGoogleConfig();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!googleClientId) {
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );

    const initializeGoogle = () => {
      const gWindow = window as GoogleWindow;
      const accounts = gWindow.google?.accounts;

      if (!accounts?.id) {
        setErrorMessage("Google Identity script did not load correctly.");
        return;
      }

      accounts.id.initialize({
        client_id: googleClientId,
        use_fedcm_for_prompt: true,
        callback: async (response) => {
          if (!response.credential) {
            setErrorMessage("Google sign-in failed. Missing credential token.");
            return;
          }

          setErrorMessage(null);

          try {
            await googleLoginMutation.mutateAsync({
              id_token: response.credential,
            });
            router.replace("/");
            router.refresh();
          } catch (error) {
            setErrorMessage(
              error instanceof Error
                ? error.message
                : "Google login failed. Please try again.",
            );
          }
        },
      });

      setGoogleReady(true);
    };

    if (existingScript) {
      initializeGoogle();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogle;
    script.onerror = () => {
      setErrorMessage("Unable to load Google Identity script.");
    };

    document.head.appendChild(script);
  }, [googleClientId, googleLoginMutation, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      await loginMutation.mutateAsync({ email, password });
      router.replace("/");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
      );
    }
  }

  function handleGoogleSignIn() {
    setErrorMessage(null);

    if (!googleReady) {
      setErrorMessage("Google sign-in is still loading. Please try again.");
      return;
    }

    const accounts = (window as GoogleWindow).google?.accounts;
    accounts?.id.prompt();
  }

  return (
    <div className="mx-auto grid min-h-screen w-full  grid-cols-1 bg-surface-2 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
      <section className="flex min-h-screen items-center justify-center border-r border-border-default bg-surface-2 p-8 md:p-12">
        <div className="mx-auto w-full max-w-lg">
          <div className="mb-10 flex items-center gap-3">
            <Image
              src="/logo/golden-main-transparent.png"
              alt="PrepIQ logo"
              width={50}
              height={50}
              className="h-14 w-14"
              priority
            />
            <span className="font-display text-2xl font-semibold tracking-tight text-text-primary">
              PrepIQ
            </span>
          </div>

          <h1 className="font-display text-[40px] font-semibold leading-[48px] tracking-tight text-text-primary">
            Welcome Back
          </h1>
          <p className="mt-3 text-[14px] leading-[22px] text-text-secondary">
            Sign in to access your kitchen command layer.
          </p>

          <form
            className="mt-10 rounded-card border border-border-default bg-surface-3 p-6 space-y-4"
            onSubmit={handleSubmit}
          >
            <Input
              label="Email"
              type="email"
              placeholder="Enter your email"
              leadingIcon={<Mail />}
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              leadingIcon={<Lock />}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              trailingIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="inline-flex items-center justify-center rounded-sm text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-gold"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeClosed /> : <Eye />}
                </button>
              }
            />

            <div className="flex items-center justify-between pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded-[4px] border border-border-default bg-surface-2 accent-[var(--color-brand-gold)]"
                />
                Remember me
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-brand-gold hover:text-brand-gold-hover"
              >
                Forgot password?
              </Link>
            </div>

            {errorMessage ? (
              <p className="text-sm text-status-critical">{errorMessage}</p>
            ) : null}

            <Button type="submit" fullWidth disabled={isBusy}>
              {loginMutation.isPending ? "Signing In..." : "Sign In"}
            </Button>

            <div className="flex items-center gap-3 py-2">
              <div className="h-px flex-1 bg-border-default" />
              <span className="text-xs uppercase tracking-[0.18em] text-text-muted">
                or
              </span>
              <div className="h-px flex-1 bg-border-default" />
            </div>

            <Button
              type="button"
              variant="secondary"
              fullWidth
              leftIcon={<GoogleColorMark />}
              onClick={handleGoogleSignIn}
              disabled={isBusy || !googleClientId}
            >
              {googleLoginMutation.isPending
                ? "Connecting Google..."
                : "Continue with Google"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Not registered yet?{" "}
            <Link
              href="/register"
              className="font-medium text-brand-gold hover:text-brand-gold-hover"
            >
              Create an account
            </Link>
          </p>
        </div>
      </section>

      <aside className="relative hidden min-h-screen bg-surface-3 p-8 md:p-12 lg:flex lg:items-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(168,130,31,0.2),transparent_45%),radial-gradient(circle_at_10%_100%,rgba(58,110,165,0.2),transparent_48%)]" />

        <div className="relative z-10 mx-auto flex w-full max-w-lg flex-col gap-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-gold">
              Kitchen Intelligence
            </p>
            <h2 className="mt-5 font-display text-[40px] font-semibold leading-[48px] tracking-tight text-text-primary">
              Control margin variance before service starts.
            </h2>
            <p className="mt-6 text-[16px] leading-[24px] text-text-secondary">
              PrepIQ translates prep activity into financial signal. Detect
              leakage, assign ownership, and execute corrective actions by the
              next shift.
            </p>
          </div>

          <div className="rounded-card border border-border-default bg-surface-2/70 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
              Daily Discipline
            </p>
            <p className="mt-3 text-[14px] leading-[22px] text-text-secondary">
              "Production delta flagged at +12%. Recommended action issued
              before opening."
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
