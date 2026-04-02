"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  useCurrentSubscription,
  useCheckoutPayment,
  useSubscriptionPlanPricing,
} from "@/services/payment/hooks";
import { useBranches, useCurrentUserProfile } from "@/services";
import type { Branch } from "@/services/branches/types";

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
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);

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

  return (
    <div className="min-h-screen bg-surface-1 p-6">
      <div className="mx-auto w-full max-w-[1024px] py-8">
        <div className="mb-10">
          <h1 className="font-display text-3xl md:text-4xl font-semibold text-text-primary mb-3">
            Finalize Your Subscription
          </h1>
          <p className="text-base text-text-muted max-w-2xl">
            Confirm your plan, branch, and payment details to complete the
            checkout process.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8">
          <div className="space-y-6">
            <Select
              label="Selected plan"
              options={plans.map((plan) => ({
                value: plan.id,
                label: `${plan.name}`,
              }))}
              value={selectedPlanId}
              onChange={(value) => {
                setSelectedPlanId(value);
                setSubmitError("");
              }}
              placeholder="Choose a plan"
            />

            <div className="space-y-3">
              <p className="text-sm font-medium text-text-secondary">
                Billing cycle
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setBillingCycle("MONTHLY")}
                  className={`h-11 rounded-button border text-sm font-medium transition-colors ${
                    billingCycle === "MONTHLY"
                      ? "border-brand-gold bg-brand-gold/15 text-brand-gold"
                      : "border-border-default bg-surface-3 text-text-secondary hover:bg-surface-4"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("YEARLY")}
                  className={`h-11 rounded-button border text-sm font-medium transition-colors ${
                    billingCycle === "YEARLY"
                      ? "border-brand-gold bg-brand-gold/15 text-brand-gold"
                      : "border-border-default bg-surface-3 text-text-secondary hover:bg-surface-4"
                  }`}
                >
                  Yearly
                </button>
              </div>
            </div>

            <Select
              label="Branch"
              options={branches.map((branch: Branch) => ({
                value: branch.id,
                label: `${branch.name}${branch.is_primary ? " · Primary" : ""}`,
              }))}
              value={selectedBranchId}
              onChange={(value) => {
                setSelectedBranchId(value);
                setSubmitError("");
              }}
              placeholder={
                branchesQuery.isLoading
                  ? "Loading branches..."
                  : "Select a branch"
              }
              disabled={branchesQuery.isLoading || !branches.length}
            />

            <Select
              label="Payment method"
              options={[
                { value: "CARD", label: "Card (Stripe)" },
                { value: "MOBILE_MONEY", label: "Mobile money (PawaPay)" },
              ]}
              value={paymentMethod}
              onChange={(value) => {
                setPaymentMethod(value);
                setSubmitError("");
              }}
            />
          </div>

          <div className="space-y-6">
            <Input
              label="Business name"
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              placeholder="PrepIQ HQ"
            />
            <Input
              label="Billing email"
              type="email"
              value={billingEmail}
              onChange={(event) => setBillingEmail(event.target.value)}
              placeholder="finance@prepiq.com"
            />
            <Input
              label="Billing phone"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="+256 700 123 456"
            />

            <div className="rounded-card border border-chart-grid bg-surface-3 p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted mb-2">
                Summary
              </p>
              <p className="text-[14px] text-text-secondary">
                Plan:{" "}
                <span className="text-text-primary">
                  {selectedPlan?.name ?? "Not selected"}
                </span>
              </p>
              <p className="text-[14px] text-text-secondary">
                Billing:{" "}
                <span className="text-text-primary">
                  {billingCycle === "MONTHLY" ? "Monthly" : "Yearly"}
                </span>
              </p>
              <p className="text-[14px] text-text-secondary">
                Branch:{" "}
                <span className="text-text-primary">
                  {branches.find((branch) => branch.id === selectedBranchId)
                    ?.name ?? "Not selected"}
                </span>
              </p>
              <p className="text-[14px] text-text-secondary">
                Payment rail:{" "}
                <span className="text-text-primary">
                  {paymentMethod === "CARD" ? "Stripe" : "PawaPay"}
                </span>
              </p>
              <p className="text-[13px] text-text-muted mt-3">
                You will be redirected to the payment gateway to complete the
                charge.
              </p>
            </div>

            {submitError ? (
              <div className="rounded-card border border-status-critical/50 bg-[#2A1E1E] p-3 text-[13px] text-[#F2B8B5]">
                {submitError}
              </div>
            ) : null}

            <Button
              fullWidth
              onClick={handleCheckout}
              disabled={checkoutMutation.isPending}
            >
              {checkoutMutation.isPending
                ? "Starting checkout..."
                : "Proceed to payment"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
