import { Suspense } from "react";
import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { VerifyOtpForm } from "./verify-otp-form";

export default function VerifyOtpPage() {
  return (
    <AuthSplitShell badgeLabelKey="auth.verificationSequence">
      <Suspense
        fallback={
          <div className="w-full max-w-md h-96 rounded-lg bg-surface-2 animate-pulse" />
        }
      >
        <VerifyOtpForm />
      </Suspense>
    </AuthSplitShell>
  );
}
