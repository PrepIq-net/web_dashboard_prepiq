import { Suspense } from "react";
import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { RecoveryVerifyForm } from "./recovery-verify-form";

export default function RecoveryVerifyPage() {
  return (
    <AuthSplitShell badgeLabelKey="auth.securityProtocol">
      <Suspense
        fallback={
          <div className="w-full max-w-md h-96 rounded-lg bg-surface-2 animate-pulse" />
        }
      >
        <RecoveryVerifyForm />
      </Suspense>
    </AuthSplitShell>
  );
}
