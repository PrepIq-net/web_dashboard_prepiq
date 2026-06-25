"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  InfoCircle,
  ShieldCheck,
} from "iconoir-react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  useBranches,
  useCheckoutPayment,
  useCurrentUserProfile,
  useSubscriptionPlanPricing,
} from "@/services";

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function fmtCurrency(v: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
}

function asStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

export default function WorkspaceCheckoutPage() {
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

  const price = useMemo(() => {
    if (!selectedPlan) return 0;
    return cycleFromUrl === "MONTHLY"
      ? toNum(selectedPlan.monthly_price)
      : toNum(selectedPlan.yearly_price);
  }, [selectedPlan, cycleFromUrl]);

  const features = asStrings(selectedPlan?.features);

  function handlePay() {
    setSubmitError("");
    if (!planIdFromUrl) {
      setSubmitError("No plan selected. Go back and select a plan.");
      return;
    }
    if (!branchIdFromUrl) {
      setSubmitError("No location selected. Go back and select a location.");
      return;
    }
    if (!businessName.trim() || !billingEmail.trim() || !phoneNumber.trim()) {
      setSubmitError("Business name, billing email, and phone number are all required.");
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
      },
      {
        onSuccess: (res) => {
          if (res.payment_link) {
            window.location.href = res.payment_link;
          } else {
            router.push("/workspace/billing?payment=success");
          }
        },
        onError: (err: unknown) => {
          const msg =
            err instanceof Error
              ? err.message
              : "Checkout failed — please try again or contact support.";
          setSubmitError(msg);
        },
      },
    );
  }

  const isLoading = userLoading || plansQuery.isLoading || branchesQuery.isLoading;

  if (isLoading) {
    return (
      <WorkspaceShell
        eyebrow="Billing"
        title="Checkout"
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
      eyebrow="Billing"
      title="Checkout"
      description={
        selectedPlan && selectedBranch
          ? `${selectedPlan.name} plan · ${selectedBranch.name} · ${cycleFromUrl === "MONTHLY" ? "Monthly" : "Yearly"} billing`
          : "Complete your subscription purchase."
      }
      insight="Your card is never stored on our servers. All payments are processed via a PCI-compliant gateway."
    >
      <div className="pt-6">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="mb-8 flex items-center gap-1.5 text-[12px] font-medium text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to plans
        </button>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          {/* ── Left: form ── */}
          <div className="lg:col-span-3 space-y-8">

            {/* Billing details */}
            <section className="rounded-xl border border-surface-4 bg-surface-2 p-6">
              <h2 className="mb-5 text-[13px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                Billing details
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Business name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Acme Restaurants"
                />
                <Input
                  label="Billing email"
                  type="email"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  placeholder="billing@yourcompany.com"
                />
                <Input
                  label="Phone number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 555 000 0000"
                />
              </div>
            </section>

            {/* Payment method */}
            <section className="rounded-xl border border-surface-4 bg-surface-2 p-6">
              <h2 className="mb-5 text-[13px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                Payment method
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
                    Credit / Debit Card
                  </p>
                  <p className="text-[11px] text-text-muted">
                    Visa, Mastercard, and all major cards accepted
                  </p>
                </div>
                <CheckCircle className="h-4 w-4 shrink-0 text-brand-gold" />
              </div>

              <div className="mt-4 flex items-center gap-2 text-[11px] text-text-muted">
                <ShieldCheck className="h-3.5 w-3.5 text-brand-gold" />
                Secure, encrypted payment — you will be redirected to complete payment.
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
                  Order summary
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
                      {cycleFromUrl === "MONTHLY" ? "Monthly" : "Yearly"} ·{" "}
                      {selectedBranch?.name ?? "—"}
                    </p>
                  </div>
                  <p className="shrink-0 text-[14px] font-semibold text-text-primary">
                    {fmtCurrency(price)}
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
                      Total due today
                    </p>
                    <p className="text-[28px] font-semibold text-text-primary leading-none">
                      {fmtCurrency(price)}
                    </p>
                  </div>
                  <p className="mt-1 text-[11px] text-text-muted text-right">
                    {cycleFromUrl === "MONTHLY" ? "billed monthly" : "billed yearly"}
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
                      Processing…
                    </span>
                  ) : (
                    `Pay ${fmtCurrency(price)}`
                  )}
                </button>

                <p className="text-center text-[10px] text-text-muted leading-relaxed">
                  By continuing you agree to PrepIQ's Terms of Service.
                  Subscription renews automatically. Cancel anytime.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
