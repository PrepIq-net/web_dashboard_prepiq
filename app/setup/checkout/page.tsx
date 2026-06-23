"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  ShieldCheck,
  CreditCard,
  MultiplePages,
  InfoCircle,
  DoubleCheck,
  CoinsSwap,
} from "iconoir-react";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  useCurrentSubscription,
  useCheckoutPayment,
  useSubscriptionPlanPricing,
} from "@/services/payment/hooks";
import { useBranches, useCurrentUserProfile } from "@/services";
import { useTranslation } from "@/lib/i18n";
import type { Branch } from "@/services/branches/types";
import type { SubscriptionPlan } from "@/services/payment/types";

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatCurrency(value: unknown) {
  const amount = toNumber(value);
  return `$${amount.toLocaleString()}`;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export default function CheckoutPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: user, isLoading: userLoading } = useCurrentUserProfile();
  const plansQuery = useSubscriptionPlanPricing();
  const branchesQuery = useBranches(user?.organization_id ?? "");
  const checkoutMutation = useCheckoutPayment();

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY">(
    "MONTHLY",
  );
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CARD");
  const [businessName, setBusinessName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    const planId = searchParams.get("planId");
    const cycle = searchParams.get("cycle");
    if (planId) {
      setSelectedPlanId(planId);
    }
    if (cycle === "YEARLY") {
      setBillingCycle("YEARLY");
    } else {
      setBillingCycle("MONTHLY");
    }
  }, [searchParams]);

  const plans = useMemo(
    () => plansQuery.data?.plans ?? [],
    [plansQuery.data?.plans],
  );
  const branches = useMemo(
    () => (branchesQuery.data ?? []).filter((branch) => branch.is_active),
    [branchesQuery.data],
  );

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId),
    [plans, selectedPlanId],
  );

  const selectedBranchName = useMemo(
    () => branches.find((b) => b.id === selectedBranchId)?.name || "selected",
    [branches, selectedBranchId],
  );

  useEffect(() => {
    if (userLoading || !user) return;
    const fullName = `${user.first_name} ${user.last_name}`.trim();
    setBusinessName((prev) => prev || user.organization_name || fullName);
    setBillingEmail((prev) => prev || user.email);
    setPhoneNumber((prev) => prev || user.phone || "");
  }, [userLoading, user]);
  const currentSubscriptionQuery = useCurrentSubscription(
    selectedBranchId ? { branch_id: selectedBranchId } : undefined,
  );
  const branchSub = currentSubscriptionQuery.data;
  const isTransition =
    branchSub &&
    branchSub.status === "ACTIVE" &&
    (branchSub.plan?.id !== selectedPlanId ||
      branchSub.billing_cycle !== billingCycle);
  const currentSubPlanName = branchSub?.plan?.name;

  useEffect(() => {
    if (!branches.length) return;
    if (selectedBranchId) return;
    const primary = branches.find((branch) => branch.is_primary);
    setSelectedBranchId(primary?.id ?? branches[0]?.id ?? "");
  }, [branches, selectedBranchId]);

  const price = useMemo(() => {
    if (!selectedPlan) return 0;
    return billingCycle === "MONTHLY"
      ? toNumber(selectedPlan.monthly_price)
      : toNumber(selectedPlan.yearly_price);
  }, [selectedPlan, billingCycle]);

  function handleCheckout() {
    setSubmitError("");
    if (!selectedPlanId) {
      setSubmitError("Select a plan to continue.");
      return;
    }
    if (!selectedBranchId) {
      setSubmitError("Select a branch to attach this subscription.");
      return;
    }
    if (!businessName || !billingEmail || !phoneNumber) {
      setSubmitError("Business name, billing email, and phone are required.");
      return;
    }

    checkoutMutation.mutate(
      {
        plan_id: selectedPlanId,
        branch_id: selectedBranchId,
        billing_cycle: billingCycle,
        payment_method: paymentMethod,
        business_name: businessName,
        billing_email: billingEmail,
        phone_number: phoneNumber,
      },
      {
        onSuccess: (response) => {
          const redirect = response.payment_link;
          if (redirect) {
            window.location.href = redirect;
          }
        },
        onError: (error: any) => {
          setSubmitError(error?.message || "Checkout failed. Try again.");
        },
      },
    );
  }

  if (plansQuery.isLoading || userLoading) {
    return (
      <div className="min-h-screen bg-surface-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-text-secondary animate-pulse">
            {t("setup.checkout.initializing")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-1 text-text-primary">
      {/* Top Header */}
      <div className="border-b border-border-default bg-surface-1/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-[1240px] px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            {t("setup.checkout.backToPricing")}
          </button>

          <div className="flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 text-brand-gold" />
            <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-brand-gold">
              {t("setup.checkout.secureCheckout")}
            </span>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1240px] px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Plan Details & Form */}
          <div className="lg:col-span-7 space-y-12">
            {/* Plan Feature Summary */}
            <section className="space-y-6">
              <div>
                <h1 className="font-display text-[32px] leading-tight font-semibold mb-2">
                  {isTransition ? t("setup.checkout.completeUpgrade") : t("setup.checkout.detailsTitle")}
                </h1>
                <p className="text-text-muted text-[15px]">
                  {isTransition
                    ? t("setup.checkout.transitioning", { branch: selectedBranchName, plan: selectedPlan?.name ?? "" })
                    : t("setup.checkout.settingUp", { plan: selectedPlan?.name || "your plan" })}
                </p>
              </div>

              {/* Upgrade Transition Notice */}
              {isTransition && (
                <div className="p-5 rounded-xl border border-brand-gold/30 bg-brand-gold/5 flex items-start gap-4 animate-fade-in">
                  <div className="h-10 w-10 rounded-full bg-brand-gold/10 flex items-center justify-center shrink-0">
                    <CoinsSwap className="h-5 w-5 text-brand-gold" />
                  </div>
                  <div>
                    <h4 className="text-[15px] font-semibold text-brand-gold font-display">
                      {t("setup.checkout.upgradeTransitionDetected")}
                    </h4>
                    <p className="text-[13px] text-text-secondary leading-relaxed mt-1" dangerouslySetInnerHTML={{ __html: t("setup.checkout.upgradeTransitionDesc", { currentPlan: `<b>${currentSubPlanName}</b>`, newPlan: `<b>${selectedPlan?.name}</b>` }) }} />
                  </div>
                </div>
              )}

              {selectedPlan && (
                <div className="bg-surface-2 rounded-card border border-border-default p-8">
                  <div className="flex items-start justify-between mb-8">
                    <div>
                      <h2 className="text-[20px] font-semibold font-display">
                        {selectedPlan.name}
                      </h2>
                      <p className="text-text-muted text-[13px] mt-1">
                        {selectedPlan.tagline || t("setup.checkout.selectedTier")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[24px] font-semibold text-brand-gold">
                        {formatCurrency(price)}
                      </p>
                      <p className="text-text-muted text-[12px] uppercase tracking-wider">
                        {billingCycle === "MONTHLY"
                          ? t("setup.checkout.billedMonthly")
                          : t("setup.checkout.billedYearly")}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                    {asStringArray(selectedPlan.features).map((feature) => (
                      <div key={feature} className="flex items-start gap-3">
                        <CheckCircle className="h-4 w-4 text-status-success shrink-0 mt-0.5" />
                        <span className="text-[14px] text-text-secondary leading-normal">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>

                  {selectedPlan.plan_limits?.MAX_BRANCHES && (
                    <div className="mt-8 pt-6 border-t border-chart-grid flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <MultiplePages className="h-4 w-4 text-text-muted" />
                        <span className="text-[13px] text-text-secondary">
                          {t("setup.checkout.branchCapacity")}
                        </span>
                      </div>
                      <span className="text-[13px] font-medium">
                        {t("setup.checkout.upToBranches", { limit: selectedPlan.plan_limits.MAX_BRANCHES })}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Business Info Form */}
            <section className="space-y-8">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-surface-3 flex items-center justify-center border border-border-default text-[12px] font-bold">
                  1
                </div>
                <h2 className="text-[18px] font-semibold font-display">
                  {t("setup.checkout.businessInfo")}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <Select
                  label={t("setup.checkout.targetBranchLabel")}
                  options={branches.map((b) => ({
                    value: b.id,
                    label: `${b.name}${b.is_primary ? ` ${t("setup.checkout.primary")}` : ""}`,
                  }))}
                  value={selectedBranchId}
                  onChange={setSelectedBranchId}
                />
              </div>
            </section>

            {/* Payment Method */}
            <section className="space-y-8">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-surface-3 flex items-center justify-center border border-border-default text-[12px] font-bold">
                  2
                </div>
                <h2 className="text-[18px] font-semibold font-display">
                  {t("setup.checkout.paymentMethod")}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CARD")}
                  className={`p-6 rounded-card border text-left flex flex-col gap-4 transition-all ${
                    paymentMethod === "CARD"
                      ? "border-brand-gold bg-brand-gold/5 shadow-[0_0_0_1px_rgba(168,130,31,0.2)]"
                      : "border-border-default bg-surface-2 hover:bg-surface-3"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <CreditCard
                      className={`h-6 w-6 ${paymentMethod === "CARD" ? "text-brand-gold" : "text-text-muted"}`}
                    />
                    {paymentMethod === "CARD" && (
                      <DoubleCheck className="h-4 w-4 text-brand-gold" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-[15px]">
                      {t("setup.checkout.card")}
                    </p>
                    <p className="text-[12px] text-text-muted mt-0.5">
                      {t("setup.checkout.cardDesc")}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("MOBILE_MONEY")}
                  className={`p-6 rounded-card border text-left flex flex-col gap-4 transition-all ${
                    paymentMethod === "MOBILE_MONEY"
                      ? "border-brand-gold bg-brand-gold/5 shadow-[0_0_0_1px_rgba(168,130,31,0.2)]"
                      : "border-border-default bg-surface-2 hover:bg-surface-3"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="h-6 flex items-center text-[10px] font-bold uppercase tracking-widest text-[#B8962E]">
                      {t("setup.checkout.mpesa")}
                    </div>
                    {paymentMethod === "MOBILE_MONEY" && (
                      <DoubleCheck className="h-4 w-4 text-brand-gold" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-[15px]">{t("setup.checkout.mobileMoney")}</p>
                    <p className="text-[12px] text-text-muted mt-0.5">
                      {t("setup.checkout.mobileMoneyDesc")}
                    </p>
                  </div>
                </button>
              </div>
            </section>
          </div>

          {/* Right Column: Order Summary (Sticky) */}
          <div className="lg:col-span-5">
            <div className="sticky top-28 space-y-6">
              <div className="bg-surface-2 border border-border-default rounded-card overflow-hidden">
                <div className="p-6 border-b border-chart-grid bg-surface-3/50">
                  <h3 className="text-[12px] font-bold uppercase tracking-[0.15em] text-text-muted">
                    {t("setup.checkout.orderSummary")}
                  </h3>
                </div>

                <div className="p-8 space-y-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-[14px]">
                      <span className="text-text-secondary">
                        {t("setup.checkout.planPlan", { plan: selectedPlan?.name ?? "" })}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(price)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[14px]">
                      <span className="text-text-secondary">{t("setup.checkout.billingCycleLabel")}</span>
                      <span className="font-medium">
                        {billingCycle === "MONTHLY" ? t("setup.checkout.billedMonthly") : t("setup.checkout.billedYearly")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[14px]">
                      <span className="text-text-secondary">{t("setup.checkout.taxLabel")}</span>
                      <span className="font-medium">$0.00</span>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-chart-grid">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[12px] font-bold uppercase tracking-wider text-text-muted">
                          {t("setup.checkout.totalDueToday")}
                        </p>
                        <p className="text-[34px] font-semibold text-text-primary leading-none mt-2 font-display">
                          {formatCurrency(price)}
                        </p>
                      </div>
                      <p className="text-[12px] text-text-muted pb-1">
                        {billingCycle === "MONTHLY" ? t("setup.checkout.perMonth") : t("setup.checkout.perYear")}
                      </p>
                    </div>
                  </div>

                  <div className="pt-6">
                    {submitError && (
                      <div className="mb-4 p-4 bg-status-critical/10 border border-status-critical/20 rounded-card flex items-start gap-3">
                        <InfoCircle className="h-4 w-4 text-status-critical shrink-0 mt-0.5" />
                        <p className="text-[13px] text-status-critical">
                          {submitError}
                        </p>
                      </div>
                    )}

                    <Button
                      fullWidth
                      className="h-14 text-[16px] font-semibold"
                      onClick={handleCheckout}
                      disabled={checkoutMutation.isPending}
                    >
                      {checkoutMutation.isPending ? (
                        <span className="flex items-center gap-2">
                          <Spinner size="sm" />
                          {t("setup.checkout.processing")}
                        </span>
                      ) : (
                        t("setup.checkout.pay", { amount: formatCurrency(price) })
                      )}
                    </Button>

                    <p className="mt-4 text-[11px] text-center text-text-muted leading-relaxed" dangerouslySetInnerHTML={{ __html: t("setup.checkout.termsPrivacy").replace("PrepIQ's Terms of Service", `<a href="#" class="underline hover:text-brand-gold">PrepIQ's Terms of Service</a>`).replace("Privacy Policy", `<a href="#" class="underline hover:text-brand-gold">Privacy Policy</a>`) }} />
                  </div>
                </div>

                <div className="bg-surface-3/30 p-6 flex items-center justify-center gap-4 border-t border-chart-grid grayscale opacity-50">
                  <CreditCard className="h-6" />
                  <div className="h-4 w-px bg-border-default" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {t("setup.checkout.pciCompliant")}
                  </span>
                </div>
              </div>

              <div className="p-6 bg-surface-2 rounded-card border border-border-default flex items-start gap-4">
                <ShieldCheck className="h-5 w-5 text-brand-gold shrink-0 mt-1" />
                <div>
                  <h4 className="text-[14px] font-semibold font-display">
                    {t("setup.checkout.shieldTitle")}
                  </h4>
                  <p className="text-[12px] text-text-muted mt-1 leading-relaxed">
                    {t("setup.checkout.shieldDesc")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
