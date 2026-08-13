import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to PrepIQ — real-time kitchen intelligence, demand forecasting, and prep scheduling for your restaurant.",
};

export default function LoginPage() {
  return (
    <AuthSplitShell badgeLabelKey="auth.signIn">
      <Suspense
        fallback={
          <div className="w-full max-w-md h-96 rounded-lg bg-surface-2 animate-pulse" />
        }
      >
        <LoginForm />
      </Suspense>
    </AuthSplitShell>
  );
}
