"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle,
  RefreshDouble,
  WarningTriangle,
} from "iconoir-react";
import { useTranslation } from "@/lib/i18n";

export function SquareConnectedContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const status = String(searchParams.get("status") || "").toLowerCase();
  const isConnected = status === "connected";

  const connectionId = searchParams.get("connection_id");
  const branchId = searchParams.get("branch_id");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const title = isConnected
    ? t("setup.sales.upload.connected.successTitle")
    : t("setup.sales.upload.connected.failTitle");

  const message = useMemo(() => {
    if (isConnected) {
      return t("setup.sales.upload.connected.successMsg");
    }

    if (errorDescription) return errorDescription;
    if (error)
      return t("setup.sales.upload.connected.squareError", { error });
    return t("setup.sales.upload.connected.failMsg");
  }, [error, errorDescription, isConnected, t]);

  return (
    <div className="w-full max-w-lg rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] p-6">
      <div className="flex items-center gap-2 mb-5">
        {isConnected ? (
          <CheckCircle className="h-4 w-4 text-[#3F8F68]" />
        ) : (
          <WarningTriangle className="h-4 w-4 text-[#C48B2A]" />
        )}
        <span
          className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isConnected ? "text-[#3F8F68]" : "text-[#C48B2A]"}`}
        >
          {isConnected
            ? t("setup.sales.upload.connected.active")
            : t("setup.sales.upload.connected.actionRequired")}
        </span>
      </div>

      <h1 className="font-display text-[32px] leading-[40px] font-semibold text-[#F5F5F7] mb-2">
        {title}
      </h1>
      <p className="text-[14px] leading-[22px] text-[#8E8E93] mb-5">
        {message}
      </p>

      {isConnected && (
        <div className="rounded-[8px] border border-[#2E2E33] bg-[#232327] p-3 mb-6 space-y-1">
          <p className="text-[12px] text-[#C7C7CC]">
            {t("setup.sales.upload.connected.connId")}:{" "}
            <span className="text-[#F5F5F7]">{connectionId || "-"}</span>
          </p>
          <p className="text-[12px] text-[#C7C7CC]">
            {t("setup.sales.upload.connected.branchId")}:{" "}
            <span className="text-[#F5F5F7]">{branchId || "-"}</span>
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {isConnected ? (
          <button
            onClick={() => router.push("/setup/items")}
            className="w-full h-11 rounded-[8px] bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] text-[#141416] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
          >
            {t("setup.sales.upload.connected.seeForecast")}
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => router.push("/setup/sales/pos/square/connect")}
            className="w-full h-11 rounded-[8px] bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] text-[#141416] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
          >
            {t("setup.sales.upload.connected.retry")}
            <RefreshDouble className="h-4 w-4" />
          </button>
        )}

        <button
          onClick={() => router.push("/setup/sales/pos")}
          className="w-full h-11 rounded-[8px] border border-[#2E2E33] bg-transparent hover:bg-[#232327] text-[#C7C7CC] text-sm font-medium transition-colors"
        >
          {t("setup.sales.upload.connect.backToPos")}
        </button>
      </div>
    </div>
  );
}
}
