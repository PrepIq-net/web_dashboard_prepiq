"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, EyeClosed, Lock, Mail } from "iconoir-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { AuthBrandAside } from "@/components/auth/auth-brand-aside";
import { AuthLogoRow } from "@/components/auth/auth-logo-row";
import { Honeypot } from "@/components/auth/honeypot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/errors";
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

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState(""); // Honeypot field
  const [isUnverified, setIsUnverified] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [googleReady, setGoogleReady] = useState(false);

  const loginMutation = useSessionLoginUser();
  const googleLoginMutation = useSessionGoogleLogin();

  const isBusy = useMemo(
    () => loginMutation.isPending || googleLoginMutation.isPending,
    [loginMutation.isPending, googleLoginMutation.isPending],
  );

  useEffect(() => {
    const redirectEmail = searchParams.get("email");
    const verified = searchParams.get("verified");

    if (redirectEmail) {
      setEmail(redirectEmail);
    }

    if (verified === "1") {
      toast.success("OTP verified. You can now sign in.");
    }
  }, [searchParams]);

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
          toast.error(
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
        toast.error("Google Identity script did not load correctly.");
        return;
      }

      accounts.id.initialize({
        client_id: googleClientId,
        use_fedcm_for_prompt: true,
        callback: async (response) => {
          if (!response.credential) {
            toast.error("Google sign-in failed. Missing credential token.");
            return;
          }

          try {
            await googleLoginMutation.mutateAsync({
              id_token: response.credential,
            });
            toast.success("Signed in successfully.");
            router.replace("/");
            router.refresh();
          } catch (error) {
            toast.error(
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
      toast.error("Unable to load Google Identity script.");
    };

    document.head.appendChild(script);
  }, [googleClientId, googleLoginMutation, router]);

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
      toast.success("Signed in successfully.");
      router.replace("/");
      router.refresh();
    } catch (error) {
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
    if (!googleReady) {
      toast.error("Google sign-in is still loading. Please try again.");
      return;
    }

    const accounts = (window as GoogleWindow).google?.accounts;
    accounts?.id.prompt();
  }

  return (
    <div className="mx-auto grid min-h-screen w-full  grid-cols-1 bg-surface-2 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
      <section className="flex min-h-screen items-center justify-center border-r border-border-default bg-surface-2 p-8 md:p-12">
        <div className="mx-auto w-full max-w-lg">
          <AuthLogoRow size={64} />

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
            <Honeypot
              name="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              placeholder="Enter your email"
              leadingIcon={<Mail />}
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setIsUnverified(false);
              }}
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

            <Button type="submit" fullWidth disabled={isBusy}>
              {loginMutation.isPending ? "Signing In..." : "Sign In"}
            </Button>

            {isUnverified && (
              <div className="rounded-card border border-brand-gold/20 bg-brand-gold/5 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-xs leading-relaxed text-text-secondary">
                  Your account isn&apos;t verified yet. To continue, please{" "}
                  <Link
                    href={`/verify-otp?email=${encodeURIComponent(email)}`}
                    className="font-semibold text-brand-gold hover:underline"
                  >
                    verify your email
                  </Link>{" "}
                  using the code sent during registration. You can request a
                  fresh code there if needed.
                </p>
              </div>
            )}

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
      <AuthBrandAside />
    </div>
  );
}
