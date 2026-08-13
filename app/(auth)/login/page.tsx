import { Suspense } from "react";
import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { LoginForm } from "./login-form";

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
