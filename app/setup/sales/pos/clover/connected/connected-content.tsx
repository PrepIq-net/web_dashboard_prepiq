"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  WarningTriangle,
  ArrowRight,
  ArrowLeft,
  Refresh,
} from "iconoir-react";
import { Spinner } from "@/components/ui/spinner";

export default function CloverConnectedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );

  const connectionId = searchParams.get("connection_id");
  const errorMessage = searchParams.get("error");
  const merchantId = searchParams.get("merchant_id");

  useEffect(() => {
    // Simulate checking connection status - in real app would verify with backend
    const timer = setTimeout(() => {
      if (connectionId) {
        setStatus("success");
      } else if (errorMessage) {
        setStatus("error");
      } else {
        setStatus("error");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [connectionId, errorMessage]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
        <div className="text-center">
          <Spinner size="lg" color="#A8821F" />
          <p className="mt-4 text-[14px] text-[#8E8E93]">
            Verifying Clover connection...
          </p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="flex items-center gap-4 mb-8">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
              Step 2 — Clover Connect
            </span>
            <span className="h-px flex-1 bg-[#2E2E33]" />
          </div>

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#3A6EA5]/20 border border-[#3A6EA5] mb-4">
              <Check className="h-8 w-8 text-[#3A6EA5]" />
            </div>
            <h1 className="font-display text-[28px] leading-[36px] font-semibold text-[#F5F5F7] mb-2">
              Clover Connected
            </h1>
            <p className="text-[14px] leading-[22px] text-[#8E8E93]">
              Successfully authorized Clover for merchant{" "}
              {merchantId ? `${merchantId}` : "your account"}. Your orders and
              transaction data are now being synced.
            </p>
          </div>

          <div className="rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] p-6 mb-6">
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93] mb-1">
                  Connection ID
                </p>
                <p className="font-mono text-sm text-[#F5F5F7] break-all">
                  {connectionId || "—"}
                </p>
              </div>
              {merchantId && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93] mb-1">
                    Merchant ID
                  </p>
                  <p className="font-mono text-sm text-[#F5F5F7]">
                    {merchantId}
                  </p>
                </div>
              )}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93] mb-1">
                  Status
                </p>
                <div className="inline-flex items-center gap-2 text-sm text-[#F5F5F7]">
                  <div className="w-2 h-2 rounded-full bg-[#3A6EA5]" />
                  Active
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push("/setup/sales/forecast")}
              className="w-full h-12 bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] text-[#141416] text-sm font-semibold rounded-[8px] inline-flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowRight className="h-4 w-4" />
              See Your Forecast
            </button>
            <button
              onClick={() => router.push("/setup/sales/pos")}
              className="w-full h-12 border border-[#2E2E33] hover:border-[#3E3E43] bg-transparent text-[#F5F5F7] text-sm font-semibold rounded-[8px] inline-flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to POS Setup
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push("/setup/sales/pos")}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5A5A60] hover:text-[#8E8E93] transition-colors inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <span className="h-px flex-1 bg-[#2E2E33]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
            Step 2 — Clover Connect
          </span>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#C44949]/20 border border-[#C44949] mb-4">
            <WarningTriangle className="h-8 w-8 text-[#C44949]" />
          </div>
          <h1 className="font-display text-[28px] leading-[36px] font-semibold text-[#F5F5F7] mb-2">
            Connection Failed
          </h1>
          <p className="text-[14px] leading-[22px] text-[#8E8E93]">
            {errorMessage ||
              "We couldn't authorize your Clover account. Please try again."}
          </p>
        </div>

        <div className="rounded-[12px] border border-[#C44949]/50 bg-[#C44949]/10 p-4 mb-6">
          <p className="text-[13px] leading-[20px] text-[#C7C7CC]">
            Make sure you have the correct permissions in Clover and a stable
            internet connection.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => router.push("/setup/sales/pos/clover/connect")}
            className="w-full h-12 bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] text-[#141416] text-sm font-semibold rounded-[8px] inline-flex items-center justify-center gap-2 transition-colors"
          >
            <Refresh className="h-4 w-4" />
            Retry Clover Connection
          </button>
          <button
            onClick={() => router.push("/setup/sales/pos")}
            className="w-full h-12 border border-[#2E2E33] hover:border-[#3E3E43] bg-transparent text-[#F5F5F7] text-sm font-semibold rounded-[8px] inline-flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to POS Setup
          </button>
        </div>
      </div>
    </div>
  );
}
