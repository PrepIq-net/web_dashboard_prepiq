"use client";

import Link from "next/link";
import { CheckCircle, WarningTriangle, Clock, ArrowRight } from "iconoir-react";
import { Spinner } from "@/components/ui/spinner";
import { usePaymentDetail } from "@/services/payment/hooks";
import { useTranslation } from "@/lib/i18n";
import { formatMoney } from "@/lib/currencies";

type CheckoutSuccessProps = {
  paymentId: string;
  ctaHref: string;
  ctaLabel: string;
  retryHref: string;
};

export function CheckoutSuccessContent({
  paymentId,
  ctaHref,
  ctaLabel,
  retryHref,
}: CheckoutSuccessProps) {
  const { t } = useTranslation();

  const { data: payment, isLoading, isError } = usePaymentDetail(paymentId, {
    // Webhook confirmation can land a beat after the gateway redirect —
    // poll briefly instead of stranding the user on a "pending" screen.
    refetchInterval: (data) => (data?.status === "PENDING" ? 3000 : false),
  });

  if (!paymentId || isError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center px-6">
        <WarningTriangle className="h-10 w-10 text-status-critical" />
        <h1 className="font-display text-[22px] font-semibold">
          {t("setup.checkout.success.notFoundTitle")}
        </h1>
        <p className="max-w-sm text-[13px] text-text-muted">
          {t("setup.checkout.success.notFoundDesc")}
        </p>
        <Link
          href={retryHref}
          className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand-gold px-6 text-[13px] font-semibold text-[#141416] transition-all hover:bg-[#B8962E]"
        >
          {t("setup.checkout.success.backToCheckout")}
        </Link>
      </div>
    );
  }

  if (isLoading || !payment) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Spinner size="lg" />
        <p className="text-[13px] text-text-muted animate-pulse">
          {t("setup.checkout.success.loading")}
        </p>
      </div>
    );
  }

  if (payment.status === "FAILED") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-critical/10">
          <WarningTriangle className="h-8 w-8 text-status-critical" />
        </div>
        <h1 className="font-display text-[24px] font-semibold">
          {t("setup.checkout.success.failedTitle")}
        </h1>
        <p className="max-w-sm text-[13px] text-text-muted leading-relaxed">
          {payment.failure_reason || t("setup.checkout.success.failedDesc")}
        </p>
        <Link
          href={retryHref}
          className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand-gold px-6 text-[13px] font-semibold text-[#141416] transition-all hover:bg-[#B8962E]"
        >
          {t("setup.checkout.success.tryAgain")}
        </Link>
      </div>
    );
  }

  if (payment.status === "PENDING") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-gold/10">
          <Clock className="h-8 w-8 text-brand-gold" />
        </div>
        <h1 className="font-display text-[24px] font-semibold">
          {t("setup.checkout.success.pendingTitle")}
        </h1>
        <p className="max-w-sm text-[13px] text-text-muted leading-relaxed">
          {t("setup.checkout.success.pendingDesc")}
        </p>
        <Spinner size="sm" />
      </div>
    );
  }

  // COMPLETED
  const completedAt = payment.completed_at
    ? new Date(payment.completed_at).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-success/10">
            <CheckCircle className="h-8 w-8 text-status-success" />
          </div>
          <h1 className="mt-5 font-display text-[26px] font-semibold">
            {t("setup.checkout.success.title")}
          </h1>
          <p className="mt-2 text-[13px] text-text-muted leading-relaxed">
            {t("setup.checkout.success.description")}
          </p>
        </div>

        <div className="mt-8 rounded-xl border border-border-default bg-surface-2 overflow-hidden">
          <div className="divide-y divide-chart-grid">
            {payment.subscription_plan && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-[12px] text-text-muted">
                  {t("setup.checkout.success.plan")}
                </span>
                <span className="text-[13px] font-medium">
                  {payment.subscription_plan}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-[12px] text-text-muted">
                {t("setup.checkout.success.amountPaid")}
              </span>
              <span className="text-[13px] font-semibold">
                {formatMoney(payment.amount, payment.currency)}
              </span>
            </div>
            {completedAt && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-[12px] text-text-muted">
                  {t("setup.checkout.success.date")}
                </span>
                <span className="text-[13px] font-medium">{completedAt}</span>
              </div>
            )}
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-[12px] text-text-muted">
                {t("setup.checkout.success.reference")}
              </span>
              <span className="text-[12px] font-mono text-text-secondary">
                {payment.reference_number}
              </span>
            </div>
          </div>
        </div>

        <Link
          href={ctaHref}
          className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-gold text-[13px] font-semibold text-[#141416] transition-all hover:bg-[#B8962E] active:scale-[0.98]"
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
