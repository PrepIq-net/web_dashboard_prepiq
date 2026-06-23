"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FastArrowRight, Brain, Sparks } from "iconoir-react";
import { Spinner } from "@/components/ui/spinner";
import {
  useProductionIntelligenceAccessScope,
  useSetupForecastWOW,
} from "@/services/production-intelligence/hooks";
import { useTranslation } from "@/lib/i18n";

function toCurrency(value: string | number): string {
  const parsed = typeof value === "number" ? value : Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(parsed) ? parsed : 0);
}

export default function AutoForecastPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const scopeQuery = useProductionIntelligenceAccessScope();

  const defaultBranchId = useMemo(() => {
    const scope = scopeQuery.data;
    if (!scope) return "";
    return scope.default_branch_id || scope.accessible_branches[0]?.id || "";
  }, [scopeQuery.data]);

  const forecastQuery = useSetupForecastWOW(
    {
      branch_id: defaultBranchId || undefined,
      horizon_weeks: 3,
    },
    Boolean(defaultBranchId),
  );

  const loading = scopeQuery.isLoading || forecastQuery.isLoading;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
        <div className="w-full max-w-2xl flex flex-col items-center justify-center py-20 text-center">
          <div className="relative flex items-center justify-center mb-8">
            <Spinner size="xl" color="#A8821F" />
            <div className="absolute inset-0 flex items-center justify-center animate-pulse">
              <Brain className="h-5 w-5 text-[#A8821F]" />
            </div>
          </div>
          <h1 className="font-display text-[28px] leading-[36px] font-semibold text-[#F5F5F7] mb-3">
            {t("setup.forecast.loadingTitle")}
          </h1>
          <p className="text-[14px] text-[#8E8E93]">
            {t("setup.forecast.loadingDesc")}
          </p>
        </div>
      </div>
    );
  }

  if (scopeQuery.isError || forecastQuery.isError || !forecastQuery.data) {
    return (
      <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-[12px] border border-[#C44949]/50 bg-[#1C1C1F] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C44949] mb-2">
            {t("setup.forecast.errorBadge")}
          </p>
          <h1 className="font-display text-[28px] leading-[36px] font-semibold text-[#F5F5F7] mb-2">
            {t("setup.forecast.errorTitle")}
          </h1>
          <p className="text-[14px] leading-[22px] text-[#8E8E93] mb-6">
            {t("setup.forecast.errorDesc")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => router.push("/setup/sales")}
              className="h-11 px-6 rounded-[8px] bg-[#A8821F] hover:bg-[#B8962E] text-[#141416] text-sm font-semibold inline-flex items-center gap-2 transition-colors"
            >
              {t("setup.forecast.addSalesData")}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => router.push("/setup/staff")}
              className="h-11 px-6 rounded-[8px] border border-[#2E2E33] bg-transparent hover:bg-[#232327] text-[#C7C7CC] text-sm font-medium inline-flex items-center gap-2 transition-colors"
            >
              {t("setup.forecast.continueAnyway")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const insight = forecastQuery.data;
  const first = insight.first_real_insight;
  const leakage = insight.money_leakage;

  return (
    <div className="min-h-screen bg-[#141416] p-6">
      <div className="w-full max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Sparks className="h-4 w-4 text-[#A8821F]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
            {t("setup.forecast.step")}
          </span>
        </div>

        <h1 className="font-display text-[36px] leading-[44px] font-semibold text-[#F5F5F7] mb-2">
          {t("setup.forecast.insightTitle", { branch: insight.branch_name })}
        </h1>
        <p className="text-[15px] leading-[24px] text-[#A0A0A5] mb-8">
          {t("setup.forecast.insightDesc", { days: insight.lookback_days })}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <div className="lg:col-span-2 rounded-[14px] border border-[#2E2E33] bg-[#1C1C1F] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8E8E93] mb-4">
              {t("setup.forecast.insightSectionTitle")}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-[10px] border border-[#2E2E33] bg-[#232327] p-3">
                <p className="text-[11px] text-[#8E8E93]">{t("setup.forecast.forecast")}</p>
                <p className="text-[24px] font-semibold text-[#F5F5F7]">{first.forecast_quantity}</p>
              </div>
              <div className="rounded-[10px] border border-[#2E2E33] bg-[#232327] p-3">
                <p className="text-[11px] text-[#8E8E93]">{t("setup.forecast.prepared")}</p>
                <p className="text-[24px] font-semibold text-[#F5F5F7]">{first.prepared_quantity}</p>
              </div>
              <div className="rounded-[10px] border border-[#2E2E33] bg-[#232327] p-3">
                <p className="text-[11px] text-[#8E8E93]">{t("setup.forecast.sold")}</p>
                <p className="text-[24px] font-semibold text-[#F5F5F7]">{first.sold_quantity}</p>
              </div>
              <div className="rounded-[10px] border border-[#2E2E33] bg-[#232327] p-3">
                <p className="text-[11px] text-[#8E8E93]">{t("setup.forecast.wasteCost")}</p>
                <p className="text-[24px] font-semibold text-[#F5F5F7]">{toCurrency(first.waste_cost)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[14px] border border-[#2E2E33] bg-[#1C1C1F] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8E8E93] mb-4">
              {t("setup.forecast.moneyProtection")}
            </p>
            <div className="space-y-3">
              <div>
                <p className="text-[11px] text-[#8E8E93]">{t("setup.forecast.projectedRevenue21d")}</p>
                <p className="text-[20px] font-semibold text-[#F5F5F7]">
                  {toCurrency(leakage.projected_revenue_21d)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#8E8E93]">{t("setup.forecast.wasteRefundLeakage30d")}</p>
                <p className="text-[20px] font-semibold text-[#C48B2A]">
                  {toCurrency(Number(leakage.waste_cost_30d) + Number(leakage.refund_leakage_30d))}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#8E8E93]">{t("setup.forecast.potentialSavings21d")}</p>
                <p className="text-[20px] font-semibold text-[#3F8F68]">
                  {toCurrency(leakage.potential_savings_21d)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <div className="rounded-[14px] border border-[#2E2E33] bg-[#1C1C1F] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8E8E93] mb-4">
              {t("setup.forecast.forecast3Weeks")}
            </p>
            <div className="space-y-3">
              {insight.next_3_weeks_forecast.map((week) => (
                <div
                  key={week.week_index}
                  className="rounded-[10px] border border-[#2E2E33] bg-[#232327] p-3 grid grid-cols-3 gap-3"
                >
                  <div>
                    <p className="text-[11px] text-[#8E8E93]">{t("setup.forecast.weekNum", { week: week.week_index })}</p>
                    <p className="text-[12px] text-[#C7C7CC]">
                      {week.start_date} - {week.end_date}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#8E8E93]">{t("setup.forecast.projectedQty")}</p>
                    <p className="text-[14px] font-semibold text-[#F5F5F7]">{week.projected_quantity}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#8E8E93]">{t("setup.forecast.projectedRevenue")}</p>
                    <p className="text-[14px] font-semibold text-[#F5F5F7]">{toCurrency(week.projected_revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[14px] border border-[#2E2E33] bg-[#1C1C1F] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8E8E93] mb-4">
              {t("setup.forecast.topItems")}
            </p>
            <div className="space-y-3">
              {insight.performance.top_items.length ? (
                insight.performance.top_items.map((item) => (
                  <div
                    key={item.item_id}
                    className="rounded-[10px] border border-[#2E2E33] bg-[#232327] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] font-semibold text-[#F5F5F7]">{item.item_title}</p>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          item.trend_percentage >= 0
                            ? "text-[#3F8F68] bg-[#3F8F68]/15"
                            : "text-[#C48B2A] bg-[#C48B2A]/15"
                        }`}
                      >
                        {item.trend_percentage >= 0 ? "+" : ""}
                        {item.trend_percentage}%
                      </span>
                    </div>
                    <p className="text-[12px] text-[#8E8E93] mt-1">
                      {t("setup.forecast.rev28dLabel")}: {toCurrency(item.last_28d_revenue)}
                    </p>
                    <p className="text-[12px] text-[#C7C7CC] mt-1">
                      {t("setup.forecast.qty3wLabel")}: {item.projected_quantity_next_weeks.join(" / ")} {item.unit}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-[13px] text-[#8E8E93]">
                  {t("setup.forecast.noItemData")}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[14px] border border-[#2E2E33] bg-[#1C1C1F] p-5 mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8E8E93] mb-3">
            {t("setup.forecast.smartPlaybook")}
          </p>
          <div className="space-y-2">
            {insight.playbook.map((line) => (
              <p key={line} className="text-[13px] text-[#C7C7CC]">
                • {line}
              </p>
            ))}
          </div>
        </div>

        <div className="pt-6 border-t border-[#2E2E33]">
          <p className="text-[13px] text-[#8E8E93] mb-4">
            {t("setup.forecast.footerDesc")}
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={() => router.push("/setup/staff")}
              className="w-full sm:w-auto h-12 px-8 bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] text-[#141416] text-sm font-semibold rounded-[8px] flex items-center justify-center gap-2 transition-colors duration-150"
            >
              {t("setup.forecast.continueTeam")}
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              onClick={() => router.push("/setup/pricing")}
              className="w-full sm:w-auto h-12 px-8 border border-[#2E2E33] bg-transparent hover:bg-[#232327] text-[#C7C7CC] text-sm font-medium rounded-[8px] inline-flex items-center justify-center gap-2 transition-colors duration-150"
            >
              {t("setup.forecast.skipToPricing")}
              <FastArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
