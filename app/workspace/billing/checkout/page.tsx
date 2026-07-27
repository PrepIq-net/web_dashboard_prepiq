"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  CoinsSwap,
  InfoCircle,
  ShieldCheck,
} from "iconoir-react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "@/lib/i18n";
import {
  useBranches,
  useCheckoutPayment,
  useCurrentSubscription,
  useCurrentUserProfile,
  useSubscriptionPlanPricing,
} from "@/services";
import { formatMoney } from "@/lib/currencies";

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function asStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

export default function WorkspaceCheckoutPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const planIdFromUrl = searchParams.get("planId") ?? "";
  const cycleFromUrl = (searchParams.get("cycle") as "MONTHLY" | "YEARLY") ?? "YEARLY";
  const branchIdFromUrl = searchParams.get("branchId") ?? "";

  const { data: user, isLoading: userLoading } = useCurrentUserProfile();
  const branchesQuery = useBranches(user?.organization_id ?? "");
  const plansQuery = useSubscriptionPlanPricing();
  const checkoutMutation = useCheckoutPayment();

  const [businessName, setBusinessName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitError, setSubmitError] = useState("");

  // Seed billing info from user profile
  useEffect(() => {
    if (userLoading || !user) return;
    const full = `${user.first_name} ${user.last_name}`.trim();
    setBusinessName((prev) => prev || user.organization_name || full);
    setBillingEmail((prev) => prev || user.email);
    setPhoneNumber((prev) => prev || user.phone || "");
  }, [userLoading, user]);

  const branches = useMemo(
    () => (branchesQuery.data ?? []).filter((b) => b.is_active),
    [branchesQuery.data],
  );
  const plans = plansQuery.data?.plans ?? [];
  const selectedPlan = plans.find((p) => p.id === planIdFromUrl);
  const selectedBranch = branches.find((b) => b.id === branchIdFromUrl);

  const currentSubscriptionQuery = useCurrentSubscription(
    branchIdFromUrl ? { branch_id: branchIdFromUrl } : undefined,
  );
  const branchSub = currentSubscriptionQuery.data;
  // Paying while a free trial is still running doesn't cut the trial short —
  // the backend defers the paid period to start once the trial ends.
  const isActiveTrial =
    Boolean(branchSub) && branchSub!.status === "ACTIVE" && Boolean(branchSub!.is_trial);
  const trialEndsAtLabel = branchSub?.trial_ends_at
    ? new Date(branchSub.trial_ends_at).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const price = useMemo(() => {
    if (!selectedPlan) return 0;
    return cycleFromUrl === "MONTHLY"
      ? toNum(selectedPlan.monthly_price)
      : toNum(selectedPlan.yearly_price);
  }, [selectedPlan, cycleFromUrl]);

  // Subscriptions are billed in USD only — the branch's operating currency
  // never applies to billing, so there is no conversion to show.
  const displayPrice = (v: number) => formatMoney(v, "USD");

  const features = asStrings(selectedPlan?.features);

  function handlePay() {
    setSubmitError("");
    if (!planIdFromUrl) {
      setSubmitError(t("setup.checkout.noPlanSelected"));
      return;
    }
    if (!branchIdFromUrl) {
      setSubmitError(t("setup.checkout.noLocationSelected"));
      return;
    }
    if (!businessName.trim() || !billingEmail.trim() || !phoneNumber.trim()) {
      setSubmitError(t("setup.checkout.fieldsRequired"));
      return;
    }

    checkoutMutation.mutate(
      {
        plan_id: planIdFromUrl,
        branch_id: branchIdFromUrl,
        billing_cycle: cycleFromUrl,
        payment_method: "CARD",
        business_name: businessName.trim(),
        billing_email: billingEmail.trim(),
        phone_number: phoneNumber.trim(),
        checkout_source: "workspace",
      },
      {
        onSuccess: (res) => {
          if (res.payment_link) {
            window.location.href = res.payment_link;
          } else {
            router.push(`/workspace/billing/checkout/success?paymentId=${res.payment.id}`);
          }
        },
        onError: (err: unknown) => {
          const msg =
            err instanceof Error
              ? err.message
              : t("setup.checkout.checkoutFailed");
          setSubmitError(msg);
        },
      },
    );
  }

  const isLoading = userLoading || plansQuery.isLoading || branchesQuery.isLoading;

  if (isLoading) {
    return (
      <WorkspaceShell
        eyebrow={t("setup.checkout.billing")}
        title={t("setup.checkout.title")}
        description=""
        insight=""
      >
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner size="lg" />
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      eyebrow={t("setup.checkout.billing")}
      title={t("setup.checkout.title")}
      description={
        selectedPlan && selectedBranch
          ? t("setup.checkout.descriptionWithDetails", {
              plan: selectedPlan.name,
              branch: selectedBranch.name,
              cycle: t(cycleFromUrl === "MONTHLY" ? "setup.checkout.monthlyLabel" : "setup.checkout.yearlyLabel"),
            })
          : t("setup.checkout.completePurchase")
      }
      insight={t("setup.checkout.cardNotStored")}
    >
      <div className="pt-6">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="mb-8 flex items-center gap-1.5 text-[12px] font-medium text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("setup.checkout.backToPlans")}
        </button>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          {/* ── Left: form ── */}
          <div className="lg:col-span-3 space-y-8">

            {/* Trial Deferral Notice — paying mid-trial doesn't cut the trial short */}
            {isActiveTrial && (
              <div className="flex items-start gap-4 rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-gold/10">
                  <CoinsSwap className="h-5 w-5 text-brand-gold" />
                </div>
                <div>
                  <h4 className="font-display text-[15px] font-semibold text-brand-gold">
                    {t("setup.checkout.trialDeferralDetected")}
                  </h4>
                  <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
                    {trialEndsAtLabel
                      ? t("setup.checkout.trialDeferralDescWithDate", { date: trialEndsAtLabel })
                      : t("setup.checkout.trialDeferralDesc")}
                  </p>
                </div>
              </div>
            )}

            {/* Billing details */}
            <section className="rounded-xl border border-surface-4 bg-surface-2 p-6">
              <h2 className="mb-5 text-[13px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                {t("setup.checkout.billingDetails")}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label={t("setup.checkout.businessNameLabel")}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder={t("setup.checkout.businessNamePlaceholder")}
                />
                <Input
                  label={t("setup.checkout.billingEmailLabel")}
                  type="email"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  placeholder={t("setup.checkout.billingEmailPlaceholder")}
                />
                <Input
                  label={t("setup.checkout.phoneNumberLabel")}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder={t("setup.checkout.phoneNumberPlaceholder")}
                />
              </div>
            </section>

            {/* Payment method */}
            <section className="rounded-xl border border-surface-4 bg-surface-2 p-6">
              <h2 className="mb-5 text-[13px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                {t("setup.checkout.paymentMethod")}
              </h2>

              {/* Single card option — selected by default */}
              <div className="flex items-center gap-3 rounded-lg border border-brand-gold bg-brand-gold/5 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gold/15">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 text-brand-gold"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <path d="M2 10h20" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-text-primary">
                    {t("setup.checkout.card")}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {t("setup.checkout.cardAccepted")}
                  </p>
                </div>
                <CheckCircle className="h-4 w-4 shrink-0 text-brand-gold" />
              </div>

              <div className="mt-4 flex items-center gap-2 text-[11px] text-text-muted">
                <ShieldCheck className="h-3.5 w-3.5 text-brand-gold" />
                {t("setup.checkout.securePayment")}
              </div>
            </section>

            {/* Error */}
            {submitError && (
              <div className="flex items-start gap-3 rounded-xl border border-status-critical/20 bg-status-critical/8 px-4 py-3">
                <InfoCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-critical" />
                <p className="text-[13px] text-status-critical">{submitError}</p>
              </div>
            )}
          </div>

          {/* ── Right: order summary ── */}
          <div className="lg:col-span-2">
            <div className="sticky top-6 rounded-xl border border-surface-4 bg-surface-2 overflow-hidden">
              <div className="border-b border-surface-4 bg-surface-3/40 px-5 py-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {t("setup.checkout.orderSummary")}
                </p>
              </div>

              <div className="p-5 space-y-5">
                {/* Plan */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[14px] font-semibold text-text-primary">
                      {selectedPlan?.name ?? "—"}
                    </p>
                    <p className="text-[12px] text-text-muted">
                      {t(cycleFromUrl === "MONTHLY" ? "setup.checkout.monthlyLabel" : "setup.checkout.yearlyLabel")} ·{" "}
                      {selectedBranch?.name ?? "—"}
                    </p>
                  </div>
                  <p className="shrink-0 text-[14px] font-semibold text-text-primary">
                    {displayPrice(price)}
                  </p>
                </div>

                {/* Features */}
                {features.length > 0 && (
                  <ul className="space-y-2 border-t border-surface-4 pt-4">
                    {features.slice(0, 5).map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle className="mt-0.5 h-3 w-3 shrink-0 text-status-success" />
                        <span className="text-[11px] text-text-muted leading-snug">{f}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Total */}
                <div className="border-t border-surface-4 pt-4">
                  <div className="flex items-end justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-muted">
                      {t("setup.checkout.totalDueToday")}
                    </p>
                    <p className="text-[28px] font-semibold text-text-primary leading-none">
                      {displayPrice(price)}
                    </p>
                  </div>
                  <p className="mt-1 text-[11px] text-text-muted text-right">
                    {t(cycleFromUrl === "MONTHLY" ? "setup.checkout.billedMonthly" : "setup.checkout.billedYearly")}
                  </p>
                  <p className="mt-1 text-[11px] text-text-muted text-right">
                    {t("setup.checkout.billedInUsd")}
                  </p>
                </div>

                {/* Pay button */}
                <button
                  onClick={handlePay}
                  disabled={checkoutMutation.isPending}
                  className="flex h-11 w-full items-center justify-center rounded-full bg-brand-gold text-[13px] font-semibold text-[#141416] transition-all hover:bg-[#B8962E] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {checkoutMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <Spinner size="sm" />
                      {t("setup.checkout.processing")}
                    </span>
                  ) : (
                    t("setup.checkout.pay", { amount: displayPrice(price) })
                  )}
                </button>

                <p className="text-center text-[10px] text-text-muted leading-relaxed">
                  {t("setup.checkout.termsPrivacy")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
