import { Suspense } from "react";
import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthSplitShell badgeLabelKey="auth.securityProtocol">
      <Suspense
        fallback={
          <div className="w-full max-w-md h-96 rounded-lg bg-surface-2 animate-pulse" />
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthSplitShell>
  );
}
