"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "iconoir-react";

export function TrialBanner({ daysLeft }: { daysLeft: number | null }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const isUrgent = daysLeft !== null && daysLeft <= 7;
  const daysText =
    daysLeft === null ? "" : daysLeft === 1 ? "1 day" : `${daysLeft} days`;

  return (
    <div
      className={`mb-6 flex items-center justify-between gap-4 rounded-[10px] border px-4 py-3 text-sm ${
        isUrgent
          ? "border-status-warning/30 bg-status-warning/8 text-status-warning"
          : "border-brand-gold/30 bg-brand-gold/8 text-brand-gold"
      }`}
    >
      <p className="font-medium">
        {isUrgent
          ? `Trial ends in ${daysText} — lock in your plan before access expires.`
          : `${daysText} left in your free trial. Upgrade to keep access after it ends.`}
      </p>
      <div className="flex shrink-0 items-center gap-3">
        <Link
          href="/workspace/billing"
          className={`inline-flex items-center gap-1 text-xs font-semibold transition-colors ${
            isUrgent
              ? "text-status-warning hover:text-status-warning/80"
              : "text-brand-gold hover:text-brand-gold/80"
          }`}
        >
          Choose Plan
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss trial banner"
          className={`text-xs transition-colors ${
            isUrgent
              ? "text-status-warning/60 hover:text-status-warning"
              : "text-brand-gold/60 hover:text-brand-gold"
          }`}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function PaymentFailedBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-[10px] border border-status-critical/30 bg-status-critical/8 px-4 py-3 text-sm text-status-critical">
      <p className="font-medium">
        Payment failed — your workspace access may be suspended soon. Update
        your billing to avoid interruption.
      </p>
      <div className="flex shrink-0 items-center gap-3">
        <Link
          href="/workspace/billing"
          className="inline-flex items-center gap-1 text-xs font-semibold text-status-critical transition-colors hover:text-status-critical/80"
        >
          Update Billing
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss payment failed banner"
          className="text-xs text-status-critical/60 transition-colors hover:text-status-critical"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
