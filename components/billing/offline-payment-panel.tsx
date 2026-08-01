"use client";

/**
 * "I'd rather pay by bank transfer or mobile money."
 *
 * Card checkout is not available to every customer in every market, and some
 * simply prefer not to use one. This panel shows where to send the money, takes
 * a reference and a photo of the receipt, and files a claim for a PrepIQ admin
 * to verify. Once approved the subscription activates and the customer gets the
 * same invoice and receipt a card payment produces.
 *
 * The wording is careful about one thing throughout: submitting here does not
 * activate anything. Promising otherwise would be the single most damaging bug
 * this screen could have.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bank, CheckCircle, Clock, InfoCircle, Upload } from "iconoir-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "@/lib/i18n";
import {
  getPaymentInstructions,
  listManualPaymentRequests,
  submitManualPayment,
  type PaymentInstruction,
} from "@/services/payment/manual";

const MAX_PROOF_BYTES = 10 * 1024 * 1024;

export function OfflinePaymentPanel({
  planId,
  branchId,
  billingCycle,
  expectedAmountUsd,
}: {
  planId: string;
  branchId: string;
  billingCycle: string;
  expectedAmountUsd: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const instructionsQuery = useQuery({
    queryKey: ["payment", "manual", "instructions"],
    queryFn: getPaymentInstructions,
  });
  const requestsQuery = useQuery({
    queryKey: ["payment", "manual", "requests"],
    queryFn: listManualPaymentRequests,
  });

  const [selected, setSelected] = useState<PaymentInstruction | null>(null);
  const [amount, setAmount] = useState(expectedAmountUsd);
  const [currency, setCurrency] = useState("USD");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [error, setError] = useState("");

  const pendingForBranch = (requestsQuery.data ?? []).find(
    (row) => row.branch === branchId && row.status === "PENDING",
  );

  const submitMutation = useMutation({
    mutationFn: submitManualPayment,
    onSuccess: () => {
      setError("");
      setProof(null);
      setReference("");
      queryClient.invalidateQueries({ queryKey: ["payment", "manual"] });
    },
    onError: (err: unknown) => {
      setError(
        err instanceof Error ? err.message : t("billing.offline.submitFailed"),
      );
    },
  });

  function handleSubmit() {
    setError("");
    if (!selected) {
      setError(t("billing.offline.chooseAccount"));
      return;
    }
    if (!amount.trim()) {
      setError(t("billing.offline.amountRequired"));
      return;
    }
    if (proof && proof.size > MAX_PROOF_BYTES) {
      setError(t("billing.offline.proofTooLarge"));
      return;
    }
    submitMutation.mutate({
      branchId,
      planId,
      billingCycle,
      method: selected.method,
      declaredAmount: amount.trim(),
      declaredCurrency: currency.trim().toUpperCase() || "USD",
      payerReference: reference.trim(),
      proofFile: proof,
    });
  }

  if (instructionsQuery.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="sm" />
      </div>
    );
  }

  const instructions = instructionsQuery.data ?? [];

  // Nothing configured means we have nowhere to receive money. Saying so beats
  // showing an empty form the customer can submit into a void.
  if (instructions.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-surface-4 bg-surface-3/40 px-4 py-3">
        <InfoCircle className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
        <p className="text-[12px] text-text-secondary">
          {t("billing.offline.unavailable")}
        </p>
      </div>
    );
  }

  if (pendingForBranch) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg border border-status-warning/30 bg-status-warning/10 px-4 py-3">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-text-primary">
              {t("billing.offline.pendingTitle")}
            </p>
            <p className="mt-0.5 text-[12px] text-text-secondary">
              {t("billing.offline.pendingBody", {
                reference: pendingForBranch.reference_code,
              })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const lastRejected = (requestsQuery.data ?? []).find(
    (row) => row.branch === branchId && row.status === "REJECTED",
  );

  return (
    <div className="space-y-5">
      {lastRejected?.review_note && (
        <div className="flex items-start gap-3 rounded-lg border border-status-critical/25 bg-status-critical/10 px-4 py-3">
          <InfoCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-critical" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-text-primary">
              {t("billing.offline.rejectedTitle")}
            </p>
            <p className="mt-0.5 text-[12px] text-text-secondary">
              {lastRejected.review_note}
            </p>
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-[12px] font-semibold text-text-primary">
          {t("billing.offline.step1")}
        </p>
        <div className="space-y-2">
          {instructions.map((instruction) => {
            const isSelected = selected?.id === instruction.id;
            return (
              <button
                key={instruction.id}
                type="button"
                onClick={() => setSelected(instruction)}
                aria-pressed={isSelected}
                className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${
                  isSelected
                    ? "border-brand-gold bg-brand-gold/5"
                    : "border-surface-4 hover:bg-surface-3/40"
                }`}
              >
                <Bank
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    isSelected ? "text-brand-gold" : "text-text-muted"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-text-primary">
                    {instruction.label}
                  </span>
                  <span className="block text-[11px] text-text-muted">
                    {instruction.method_label}
                    {instruction.currency ? ` · ${instruction.currency}` : ""}
                  </span>
                </span>
                {isSelected && (
                  <CheckCircle className="h-4 w-4 shrink-0 text-brand-gold" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="rounded-lg border border-surface-4 bg-surface-3/40 px-4 py-3">
          <p className="mb-2 text-[12px] font-semibold text-text-primary">
            {t("billing.offline.sendTo")}
          </p>
          <dl className="space-y-1">
            {Object.entries(selected.account_details).map(([key, value]) => (
              <div key={key} className="flex flex-wrap gap-2 text-[12px]">
                <dt className="text-text-muted">{key}</dt>
                <dd className="font-mono text-text-primary">{value}</dd>
              </div>
            ))}
          </dl>
          {selected.instructions && (
            <p className="mt-3 text-[11px] leading-relaxed text-text-secondary">
              {selected.instructions}
            </p>
          )}
        </div>
      )}

      <div>
        <p className="mb-2 text-[12px] font-semibold text-text-primary">
          {t("billing.offline.step2")}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t("billing.offline.amountPaid")}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <Input
            label={t("billing.offline.currency")}
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          />
          <div className="sm:col-span-2">
            <Input
              label={t("billing.offline.transactionRef")}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder={t("billing.offline.transactionRefPlaceholder")}
            />
          </div>
        </div>

        <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-surface-4 px-4 py-3 transition-colors hover:bg-surface-3/40 focus-within:ring-2 focus-within:ring-brand-gold">
          <Upload className="h-4 w-4 shrink-0 text-text-muted" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-text-primary">
              {proof ? proof.name : t("billing.offline.attachProof")}
            </span>
            <span className="block text-[11px] text-text-muted">
              {t("billing.offline.attachProofHint")}
            </span>
          </span>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            onChange={(event) => setProof(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-status-critical/25 bg-status-critical/10 px-4 py-3">
          <InfoCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-critical" />
          <p className="text-[12px] text-text-primary">{error}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSubmit} disabled={submitMutation.isPending}>
          {submitMutation.isPending
            ? t("billing.offline.submitting")
            : t("billing.offline.submit")}
        </Button>
        <p className="text-[11px] text-text-muted">
          {t("billing.offline.reviewNotice")}
        </p>
      </div>
    </div>
  );
}
