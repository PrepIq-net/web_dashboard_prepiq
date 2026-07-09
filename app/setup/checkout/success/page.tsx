"use client";

import { useSearchParams } from "next/navigation";
import { ShieldCheck } from "iconoir-react";
import { CheckoutSuccessContent } from "@/components/payment/checkout-success";
import { useTranslation } from "@/lib/i18n";

export default function SetupCheckoutSuccessPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("paymentId") ?? "";

  return (
    <div className="min-h-screen bg-surface-1 text-text-primary">
      <div className="border-b border-border-default bg-surface-1/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-[1240px] px-6 h-16 flex items-center justify-end">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 text-brand-gold" />
            <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-brand-gold">
              {t("setup.checkout.secureCheckout")}
            </span>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1240px] px-6">
        <CheckoutSuccessContent
          paymentId={paymentId}
          ctaHref="/workspace/today"
          ctaLabel={t("setup.checkout.success.goToDashboard")}
          retryHref="/setup/pricing"
        />
      </main>
    </div>
  );
}
