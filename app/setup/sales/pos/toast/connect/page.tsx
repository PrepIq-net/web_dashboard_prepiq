"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  InfoCircle,
  WarningTriangle,
} from "iconoir-react";
import { Spinner } from "@/components/ui/spinner";
import { Select } from "@/components/ui/select";
import {
  useProductionIntelligenceAccessScope,
  useStartToastOAuth,
} from "@/services/production-intelligence/hooks";
import { useTranslation } from "@/lib/i18n";

export default function ToastConnectPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const {
    data: scope,
    isLoading: scopeLoading,
    error: scopeError,
  } = useProductionIntelligenceAccessScope();

  const [branchId, setBranchId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const toastOAuth = useStartToastOAuth();

  const branches = useMemo(() => scope?.accessible_branches ?? [], [scope]);

  const selectedBranchId =
    branchId || scope?.default_branch_id || branches[0]?.id || "";

  async function handleToastConnect() {
    if (!selectedBranchId || !clientId || !clientSecret) return;

    try {
      const result = await toastOAuth.mutateAsync({
        branch_id: selectedBranchId,
        client_id: clientId,
        client_secret: clientSecret,
      });

      // Redirect to connected page with success status
      router.push(
        `/setup/sales/pos/toast/connected?status=connected&connection_id=${result.connection_id}&branch_id=${result.branch_id}`,
      );
    } catch (error) {
      // Error is handled by mutation state below
      console.error("Toast OAuth error:", error);
    }
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
            {t("setup.sales.upload.back")}
          </button>
          <span className="h-px flex-1 bg-[#2E2E33]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
            {t("setup.common.step", { step: 2 })} — {t("setup.sales.connectPos")}
          </span>
        </div>

        <h1 className="font-display text-[32px] leading-[40px] font-semibold text-[#F5F5F7] mb-2">
          {t("setup.sales.upload.connect.toastTitle")}
        </h1>
        <p className="text-[14px] leading-[22px] text-[#8E8E93] mb-6">
          {t("setup.sales.upload.connect.toastDesc")}
        </p>

        <div className="rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] p-5 mb-4">
          <div className="space-y-4">
            {/* Branch Selection */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93] block mb-2">
                {t("common.branch")}
              </label>

              {scopeLoading ? (
                <div className="h-11 rounded-[8px] border border-[#2E2E33] bg-[#232327] flex items-center px-3 gap-2 text-[#8E8E93] text-sm">
                  <Spinner size="sm" color="#8E8E93" />
                  {t("setup.sales.upload.loadingBranches")}
                </div>
              ) : branches.length === 0 ? (
                <div className="rounded-[8px] border border-[#C48B2A]/40 bg-[#C48B2A]/10 p-3 text-[13px] text-[#C7C7CC]">
                  {t("setup.sales.upload.connect.noBranches")}
                </div>
              ) : (
                <Select
                  label=""
                  options={branches.map((branch) => ({
                    value: branch.id,
                    label: branch.name,
                  }))}
                  value={selectedBranchId}
                  onChange={setBranchId}
                  placeholder={t("setup.sales.upload.connect.placeholder")}
                  className="space-y-0"
                />
              )}
            </div>

            {/* Info */}
            <div className="flex items-start gap-2.5 pt-2">
              <InfoCircle className="h-4 w-4 text-[#3A6EA5] shrink-0 mt-0.5" />
              <p className="text-[13px] leading-[20px] text-[#C7C7CC]">
                {t("setup.sales.upload.connect.toastInfo")}
              </p>
            </div>

            {/* Client ID */}
            <div>
              <label
                htmlFor="client-id"
                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93] block mb-2"
              >
                {t("setup.sales.upload.connect.clientId")}
              </label>
              <input
                id="client-id"
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder={t("setup.sales.upload.connect.clientIdPlaceholder")}
                className="w-full h-11 rounded-[8px] border border-[#2E2E33] bg-[#232327] px-3 text-[13px] text-[#F5F5F7] placeholder-[#5A5A60] focus:outline-none focus:border-[#A8821F] focus:ring-1 focus:ring-[#A8821F]/30 transition-colors"
              />
            </div>

            {/* Client Secret */}
            <div>
              <label
                htmlFor="client-secret"
                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93] block mb-2"
              >
                {t("setup.sales.upload.connect.clientSecret")}
              </label>
              <div className="relative">
                <input
                  id="client-secret"
                  type={showPassword ? "text" : "password"}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={t(
                    "setup.sales.upload.connect.clientSecretPlaceholder",
                  )}
                  className="w-full h-11 rounded-[8px] border border-[#2E2E33] bg-[#232327] px-3 pr-10 text-[13px] text-[#F5F5F7] placeholder-[#5A5A60] focus:outline-none focus:border-[#A8821F] focus:ring-1 focus:ring-[#A8821F]/30 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5A60] hover:text-[#8E8E93] text-sm"
                >
                  {showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                </button>
              </div>
            </div>
          </div>
        </div>

        {(scopeError || toastOAuth.error) && (
          <div className="rounded-[12px] border border-[#C44949]/50 bg-[#C44949]/10 p-4 mb-4">
            <div className="flex items-start gap-2.5">
              <WarningTriangle className="h-4 w-4 text-[#C44949] shrink-0 mt-0.5" />
              <p className="text-[13px] leading-[20px] text-[#C7C7CC]">
                {scopeError instanceof Error
                  ? scopeError.message
                  : toastOAuth.error instanceof Error
                    ? toastOAuth.error.message
                    : t("setup.sales.upload.connect.toastError")}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleToastConnect}
          disabled={
            toastOAuth.isPending ||
            scopeLoading ||
            !selectedBranchId ||
            !clientId ||
            !clientSecret
          }
          className="w-full h-12 bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] disabled:opacity-40 disabled:cursor-not-allowed text-[#141416] text-sm font-semibold rounded-[8px] inline-flex items-center justify-center gap-2 transition-colors"
        >
          {toastOAuth.isPending ? (
            <>
              <Spinner size="sm" color="#141416" />
              {t("setup.sales.upload.connect.toastConnecting")}
            </>
          ) : (
            <>
              <ArrowRight className="h-4 w-4" />
              {t("setup.sales.upload.connect.toastCta")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
