"use client";

/**
 * Paying by transfer instead of through instant checkout.
 *
 * The whole difficulty of this screen is that the customer does the hard part —
 * moving real money — in another app entirely, then comes back here. So it is
 * built around three things:
 *
 *   1. Telling them *exactly* what to send, in the currency of the account they
 *      picked, copyable field by field. A mistyped account number is a payment
 *      that has to be traced by hand.
 *   2. Not making them retype the amount. It is prefilled and read-only until
 *      they say they sent something else.
 *   3. Never implying the plan is now on. Submitting is a claim awaiting a
 *      human; promising otherwise would be the most damaging bug here.
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bank,
  Check,
  CheckCircle,
  Clock,
  Copy,
  InfoCircle,
  Upload,
  Xmark,
} from "iconoir-react";

import { Button } from "@/components/ui/button";
import { CurrencySelect } from "@/components/ui/currency-select";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "@/lib/i18n";
import { formatMoney } from "@/lib/currencies";
import {
  getPaymentMethodOptions,
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

  const optionsQuery = useQuery({
    queryKey: ["payment", "manual", "options", planId, billingCycle],
    queryFn: () => getPaymentMethodOptions({ planId, billingCycle }),
  });
  const requestsQuery = useQuery({
    queryKey: ["payment", "manual", "requests"],
    queryFn: listManualPaymentRequests,
  });

  const instructions = useMemo(
    () => optionsQuery.data?.offline.instructions ?? [],
    [optionsQuery.data],
  );
  const reviewHours = optionsQuery.data?.offline.review_hours ?? 24;

  const [selectedId, setSelectedId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  // Most people send exactly what they were asked for. Editing the amount is
  // the exception, so it stays behind a deliberate opt-in rather than sitting
  // there as an empty box to fill in.
  const [amountEdited, setAmountEdited] = useState(false);
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [error, setError] = useState("");

  const selected = instructions.find((row) => row.id === selectedId) ?? null;

  // A single account means there is no choice to make — select it for them.
  useEffect(() => {
    if (!selectedId && instructions.length === 1) setSelectedId(instructions[0].id);
  }, [instructions, selectedId]);

  // Picking an account decides the currency and therefore the amount due.
  // Resetting the edit flag matters: an amount typed for a UGX account is
  // nonsense once the customer switches to the USD one.
  useEffect(() => {
    if (!selected) return;
    const hint = selected.amount_hint;
    setCurrency(hint?.currency || selected.currency || "USD");
    setAmount(hint?.amount ?? expectedAmountUsd);
    setAmountEdited(false);
  }, [selected, expectedAmountUsd]);

  const submitMutation = useMutation({
    mutationFn: submitManualPayment,
    onSuccess: () => {
      setError("");
      setProof(null);
      setReference("");
      queryClient.invalidateQueries({ queryKey: ["payment", "manual"] });
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : t("billing.offline.submitFailed"));
    },
  });

  function handleSubmit() {
    setError("");
    if (!selected) {
      setError(t("billing.offline.chooseAccount"));
      return;
    }
    const cleaned = amount.replace(/,/g, "").trim();
    if (!cleaned || Number(cleaned) <= 0) {
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
      declaredAmount: cleaned,
      declaredCurrency: currency.trim().toUpperCase() || "USD",
      payerReference: reference.trim(),
      proofFile: proof,
    });
  }

  if (optionsQuery.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="sm" />
      </div>
    );
  }

  // Nothing configured, or the route is switched off: say so rather than
  // showing a form that submits into a void.
  if (!optionsQuery.data?.offline.enabled || instructions.length === 0) {
    return <Notice tone="neutral" body={t("billing.offline.unavailable")} />;
  }

  const requests = requestsQuery.data ?? [];
  const pending = requests.find(
    (row) => row.branch === branchId && row.status === "PENDING",
  );
  if (pending) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-status-warning/30 bg-status-warning/10 px-4 py-3">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-text-primary">
              {t("billing.offline.pendingTitle")}
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-text-secondary">
              {t("billing.offline.pendingBody", {
                reference: pending.reference_code,
                hours: String(reviewHours),
              })}
            </p>
          </div>
        </div>
        <ol className="space-y-2 pl-1">
          {[
            t("billing.offline.next1"),
            t("billing.offline.next2"),
            t("billing.offline.next3"),
          ].map((line, index) => (
            <li key={line} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-4 text-[10px] font-semibold text-text-muted">
                {index + 1}
              </span>
              <span className="text-[12px] leading-relaxed text-text-secondary">
                {line}
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const lastRejected = requests.find(
    (row) => row.branch === branchId && row.status === "REJECTED",
  );

  return (
    <div className="space-y-6">
      {lastRejected?.review_note && (
        <Notice
          tone="critical"
          title={t("billing.offline.rejectedTitle")}
          body={lastRejected.review_note}
        />
      )}

      {optionsQuery.data.offline.note && (
        <Notice tone="neutral" body={optionsQuery.data.offline.note} />
      )}

      <Step number={1} title={t("billing.offline.stepChoose")}>
        <div className="space-y-2">
          {instructions.map((instruction) => (
            <AccountOption
              key={instruction.id}
              instruction={instruction}
              isSelected={instruction.id === selectedId}
              onSelect={() => setSelectedId(instruction.id)}
            />
          ))}
        </div>
      </Step>

      {selected && (
        <>
          <Step number={2} title={t("billing.offline.stepSend")}>
            <AccountDetails instruction={selected} />
          </Step>

          <Step number={3} title={t("billing.offline.stepConfirm")}>
            <div className="space-y-4">
              {amountEdited ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label={t("billing.offline.amountPaid")}
                    value={amount}
                    inputMode="decimal"
                    autoFocus
                    onChange={(event) => setAmount(sanitizeAmount(event.target.value))}
                  />
                  <CurrencySelect
                    label={t("billing.offline.currency")}
                    value={currency}
                    onChange={setCurrency}
                  />
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-4 bg-surface-3/40 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-text-muted">
                      {t("billing.offline.amountPaid")}
                    </p>
                    <p className="mt-0.5 text-[15px] font-semibold text-text-primary">
                      {formatMoney(amount.replace(/,/g, ""), currency)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAmountEdited(true)}
                    className="rounded text-[12px] font-medium text-text-secondary underline underline-offset-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
                  >
                    {t("billing.offline.sentDifferent")}
                  </button>
                </div>
              )}

              <Input
                label={t("billing.offline.transactionRef")}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder={t("billing.offline.transactionRefPlaceholder")}
              />

              <ProofField
                proof={proof}
                onChange={setProof}
                label={t("billing.offline.attachProof")}
                hint={t("billing.offline.attachProofHint")}
                removeLabel={t("billing.offline.removeFile")}
              />
            </div>
          </Step>
        </>
      )}

      {error && <Notice tone="critical" body={error} />}

      <div className="space-y-2 border-t border-surface-4 pt-6">
        <Button
          onClick={handleSubmit}
          disabled={submitMutation.isPending || !selected}
        >
          {submitMutation.isPending
            ? t("billing.offline.submitting")
            : t("billing.offline.submit")}
        </Button>
        <p className="text-[11px] leading-relaxed text-text-muted">
          {t("billing.offline.reviewNotice", { hours: String(reviewHours) })}
        </p>
      </div>
    </div>
  );
}

/* ── pieces ──────────────────────────────────────────────────────────────── */

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2.5">
        {/* Neutral, not gold: step numbers are structure, not emphasis. Gold on
            this panel belongs to the amount to send and the selected account. */}
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-4 text-[11px] font-semibold text-text-secondary">
          {number}
        </span>
        <h3 className="text-[13px] font-semibold text-text-primary">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function AccountOption({
  instruction,
  isSelected,
  onSelect,
}: {
  instruction: PaymentInstruction;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${
        isSelected
          ? "border-brand-gold bg-brand-gold/5"
          : "border-surface-4 hover:bg-surface-3/40"
      }`}
    >
      <Bank
        className={`h-4 w-4 shrink-0 ${isSelected ? "text-brand-gold" : "text-text-muted"}`}
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
      {isSelected && <CheckCircle className="h-4 w-4 shrink-0 text-brand-gold" />}
    </button>
  );
}

function AccountDetails({ instruction }: { instruction: PaymentInstruction }) {
  const { t } = useTranslation();
  const hint = instruction.amount_hint;
  const entries = Object.entries(instruction.account_details);

  const allText = [
    ...entries.map(([key, value]) => `${key}: ${value}`),
    hint ? `${t("billing.offline.amountToSend")}: ${hint.currency} ${hint.amount}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="space-y-3">
      {hint && (
        <div className="rounded-lg border border-brand-gold/25 bg-brand-gold/5 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.1em] text-text-muted">
            {t("billing.offline.amountToSend")}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <p className="text-[20px] font-semibold leading-none text-text-primary">
              {formatMoney(hint.amount, hint.currency)}
            </p>
            <CopyButton value={hint.amount} />
          </div>
          {hint.is_estimate && (
            <p className="mt-2 text-[11px] leading-relaxed text-text-secondary">
              {t("billing.offline.estimateNote")}
            </p>
          )}
        </div>
      )}

      {entries.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-surface-4">
          {entries.map(([key, value], index) => (
            <div
              key={key}
              className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 ${
                index > 0 ? "border-t border-surface-4" : ""
              }`}
            >
              <span className="text-[11px] uppercase tracking-[0.08em] text-text-muted">
                {key}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono text-[13px] text-text-primary">
                  {value}
                </span>
                <CopyButton value={value} />
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <CopyButton value={allText} label={t("billing.offline.copyAll")} />
        {instruction.instructions && (
          <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-text-secondary">
            {instruction.instructions}
          </p>
        )}
      </div>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard access can be refused (insecure origin, permissions). The
      // value is on screen either way, so there is nothing to recover from.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label ?? t("billing.offline.copy")}
      className="inline-flex shrink-0 items-center gap-1.5 rounded px-1.5 py-1 text-[11px] font-medium text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-status-success" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {/* The tick carries the success colour; the word stays readable. Success
          is 4.3:1 and fails AA at this size (DESIGN.md §8). */}
      {(label || copied) && (
        <span className={copied ? "text-text-primary" : ""}>
          {copied ? t("billing.offline.copied") : label}
        </span>
      )}
    </button>
  );
}

function ProofField({
  proof,
  onChange,
  label,
  hint,
  removeLabel,
}: {
  proof: File | null;
  onChange: (file: File | null) => void;
  label: string;
  hint: string;
  removeLabel: string;
}) {
  if (proof) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-surface-4 bg-surface-3/40 px-4 py-3">
        <CheckCircle className="h-4 w-4 shrink-0 text-status-success" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-text-primary">
            {proof.name}
          </span>
          <span className="block text-[11px] text-text-muted">
            {(proof.size / 1024).toFixed(0)} KB
          </span>
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={removeLabel}
          className="rounded p-1 text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
        >
          <Xmark className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-surface-4 px-4 py-3 transition-colors hover:bg-surface-3/40 focus-within:ring-2 focus-within:ring-brand-gold">
      <Upload className="h-4 w-4 shrink-0 text-text-muted" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-text-primary">{label}</span>
        <span className="block text-[11px] text-text-muted">{hint}</span>
      </span>
      <input
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function Notice({
  tone,
  title,
  body,
}: {
  tone: "neutral" | "critical";
  title?: string;
  body: string;
}) {
  const styles =
    tone === "critical"
      ? "border-status-critical/25 bg-status-critical/10"
      : "border-surface-4 bg-surface-3/40";
  const iconColor = tone === "critical" ? "text-status-critical" : "text-text-muted";

  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${styles}`}>
      <InfoCircle className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
      <div className="min-w-0">
        {title && <p className="text-[13px] font-semibold text-text-primary">{title}</p>}
        <p
          className={`text-[12px] leading-relaxed text-text-secondary ${
            title ? "mt-0.5" : ""
          }`}
        >
          {body}
        </p>
      </div>
    </div>
  );
}

/** Keep the field to something that can be parsed as money, without fighting
 *  the customer's keystrokes — digits and a single decimal point, nothing else. */
function sanitizeAmount(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}
