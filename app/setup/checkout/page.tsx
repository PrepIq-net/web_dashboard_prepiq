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
  Stripe,
  DoubleCheck,
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

  useEffect(() => {
    if (userLoading || !user) return;
    const fullName = `${user.first_name} ${user.last_name}`.trim();
    setBusinessName((prev) => prev || user.organization_name || fullName);
    setBillingEmail((prev) => prev || user.email);
    setPhoneNumber((prev) => prev || user.phone || "");
  }, [userLoading, user]);

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
            Initializing secure checkout...
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
            Back to pricing
          </button>

          <div className="flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 text-brand-gold" />
            <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-brand-gold">
              Secure Checkout
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
                  Subscription Details
                </h1>
                <p className="text-text-muted text-[15px]">
                  Setting up {selectedPlan?.name || "your plan"} for your
                  organization.
                </p>
              </div>

              {selectedPlan && (
                <div className="bg-surface-2 rounded-card border border-border-default p-8">
                  <div className="flex items-start justify-between mb-8">
                    <div>
                      <h2 className="text-[20px] font-semibold font-display">
                        {selectedPlan.name}
                      </h2>
                      <p className="text-text-muted text-[13px] mt-1">
                        {selectedPlan.tagline ||
                          "Your selected operations tier"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[24px] font-semibold text-brand-gold">
                        {formatCurrency(price)}
                      </p>
                      <p className="text-text-muted text-[12px] uppercase tracking-wider">
                        {billingCycle === "MONTHLY"
                          ? "Billed Monthly"
                          : "Billed Yearly"}
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
                          Branch capacity
                        </span>
                      </div>
                      <span className="text-[13px] font-medium">
                        Up to {selectedPlan.plan_limits.MAX_BRANCHES} branches
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
                  Business Information
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Business Name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. PrepIQ Kitchens"
                />
                <Input
                  label="Billing Email"
                  type="email"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  placeholder="finance@yourcompany.com"
                />
                <Input
                  label="Phone Number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+256 700 000 000"
                />
                <Select
                  label="Target Branch"
                  options={branches.map((b) => ({
                    value: b.id,
                    label: `${b.name}${b.is_primary ? " (Primary)" : ""}`,
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
                  Payment Method
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
                      Credit / Debit Card
                    </p>
                    <p className="text-[12px] text-text-muted mt-0.5">
                      Secure payment via Stripe
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
                      M-Pesa / Mobile
                    </div>
                    {paymentMethod === "MOBILE_MONEY" && (
                      <DoubleCheck className="h-4 w-4 text-brand-gold" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-[15px]">Mobile Money</p>
                    <p className="text-[12px] text-text-muted mt-0.5">
                      Pay via PawaPay
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
                    Order Summary
                  </h3>
                </div>

                <div className="p-8 space-y-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-[14px]">
                      <span className="text-text-secondary">
                        {selectedPlan?.name} plan
                      </span>
                      <span className="font-medium">
                        {formatCurrency(price)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[14px]">
                      <span className="text-text-secondary">Billing cycle</span>
                      <span className="font-medium">
                        {billingCycle.toLowerCase()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[14px]">
                      <span className="text-text-secondary">Tax (VAT 0%)</span>
                      <span className="font-medium">$0.00</span>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-chart-grid">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[12px] font-bold uppercase tracking-wider text-text-muted">
                          Total Due Today
                        </p>
                        <p className="text-[34px] font-semibold text-text-primary leading-none mt-2 font-display">
                          {formatCurrency(price)}
                        </p>
                      </div>
                      <p className="text-[12px] text-text-muted pb-1">
                        {billingCycle === "MONTHLY" ? "per month" : "per year"}
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
                      size="lg"
                      className="h-14 text-[16px] font-semibold"
                      onClick={handleCheckout}
                      disabled={checkoutMutation.isPending}
                    >
                      {checkoutMutation.isPending ? (
                        <span className="flex items-center gap-2">
                          <Spinner size="sm" />
                          Processing...
                        </span>
                      ) : (
                        `Pay ${formatCurrency(price)}`
                      )}
                    </Button>

                    <p className="mt-4 text-[11px] text-center text-text-muted leading-relaxed">
                      By proceeding, you agree to PrepIQ&apos;s{" "}
                      <a href="#" className="underline hover:text-brand-gold">
                        Terms of Service
                      </a>{" "}
                      and{" "}
                      <a href="#" className="underline hover:text-brand-gold">
                        Privacy Policy
                      </a>
                      . Payments are non-refundable.
                    </p>
                  </div>
                </div>

                <div className="bg-surface-3/30 p-6 flex items-center justify-center gap-4 border-t border-chart-grid grayscale opacity-50">
                  <Stripe className="h-8" />
                  <div className="h-4 w-px bg-border-default" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    PCI Compliant
                  </span>
                </div>
              </div>

              <div className="p-6 bg-surface-2 rounded-card border border-border-default flex items-start gap-4">
                <ShieldCheck className="h-5 w-5 text-brand-gold shrink-0 mt-1" />
                <div>
                  <h4 className="text-[14px] font-semibold font-display">
                    Intelligence Shield
                  </h4>
                  <p className="text-[12px] text-text-muted mt-1 leading-relaxed">
                    Your data is encrypted and processed in isolated VPCs.
                    Subscription management is handled via authorized payment
                    providers only.
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
