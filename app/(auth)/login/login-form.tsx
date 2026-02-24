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
import { useSessionGoogleLogin, useSessionLoginUser } from "@/services";

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

export function LoginForm() {
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
    <div className="w-full max-w-md space-y-12 animate-fade-in">
      <div className="space-y-3 text-center">
        <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-text-primary">
          Welcome Back.
        </h1>
        <p className="text-lg text-text-secondary leading-relaxed">
          Welcome back! Please enter your details to sign in.
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
            label="Email Address"
            type="email"
            placeholder="name@organization.com"
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
            label="Password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
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
                aria-label={showPassword ? "Hide password" : "Show password"}
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
            Remember me
          </label>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-brand-gold hover:text-brand-gold-hover transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <div className="space-y-6 pt-2">
          <Button
            type="submit"
            fullWidth
            disabled={isBusy}
            className="py-7 text-base font-semibold shadow-level-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            {loginMutation.isPending ? "Authenticating..." : "Sign In"}
          </Button>

          {isUnverified && (
            <div className="rounded-card border border-brand-gold/20 bg-brand-gold/5 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <p className="text-xs leading-relaxed text-text-secondary text-center">
                Your account isn&apos;t verified yet. To continue, please{" "}
                <Link
                  href={`/verify-otp?email=${encodeURIComponent(email)}`}
                  className="font-semibold text-brand-gold hover:underline"
                >
                  verify your email
                </Link>
                .
              </p>
            </div>
          )}

          <div className="flex items-center gap-4 py-2">
            <div className="h-px flex-1 bg-border-default/50" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">
              Or sign in with
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
            disabled={isBusy || !googleClientId}
          >
            {googleLoginMutation.isPending
              ? "Connecting..."
              : "Continue with Google"}
          </Button>
        </div>
      </form>

      <p className="text-center text-sm text-text-secondary pt-8">
        New to the platform?{" "}
        <Link
          href="/register"
          className="font-semibold text-brand-gold hover:text-brand-gold-hover transition-colors"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
