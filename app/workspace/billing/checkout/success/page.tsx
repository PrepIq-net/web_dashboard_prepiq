"use client";

import { useSearchParams } from "next/navigation";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { CheckoutSuccessContent } from "@/components/payment/checkout-success";
import { useTranslation } from "@/lib/i18n";

export default function WorkspaceCheckoutSuccessPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("paymentId") ?? "";

  return (
    <WorkspaceShell
      eyebrow={t("setup.checkout.billing")}
      title={t("setup.checkout.success.title")}
      description={t("setup.checkout.success.description")}
      insight={t("setup.checkout.cardNotStored")}
    >
      <CheckoutSuccessContent
        paymentId={paymentId}
        ctaHref="/workspace/billing"
        ctaLabel={t("setup.checkout.success.backToBilling")}
        retryHref="/workspace/billing"
      />
    </WorkspaceShell>
  );
}
