"use client";

import Link from "next/link";
import { ArrowRight, DatabaseScript, CloudUpload, ShopFourTiles } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";

type SalesSourceRequiredStateProps = {
  compact?: boolean;
};

export function SalesSourceRequiredState({ compact = false }: SalesSourceRequiredStateProps) {
  const { t } = useTranslation();
  return (
    <section
      className={`rounded-[14px] border border-[#2E2E33] bg-[#1C1C1F] ${
        compact ? "p-6" : "p-8 md:p-10"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
        {t("workspace.empty.sales.eyebrow")}
      </p>
      <h1
        className={`mt-3 font-display font-semibold text-[#F5F5F7] ${
          compact ? "text-[24px] leading-[32px]" : "text-[34px] leading-[42px]"
        }`}
      >
        {t("workspace.empty.sales.title")}
      </h1>
      <p className="mt-3 max-w-3xl text-[14px] leading-[22px] text-[#8E8E93]">
        {t("workspace.empty.sales.description")}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[10px] border border-[#2E2E33] bg-[#232327] p-4">
          <div className="flex items-center gap-2 text-[#C7C7CC]">
            <DatabaseScript className="h-4 w-4 text-[#A8821F]" />
            <p className="text-[13px] font-semibold">{t("workspace.empty.sales.step1Title")}</p>
          </div>
          <p className="mt-2 text-[12px] text-[#8E8E93]">
            {t("workspace.empty.sales.step1Desc")}
          </p>
        </div>
        <div className="rounded-[10px] border border-[#2E2E33] bg-[#232327] p-4">
          <div className="flex items-center gap-2 text-[#C7C7CC]">
            <CloudUpload className="h-4 w-4 text-[#A8821F]" />
            <p className="text-[13px] font-semibold">{t("workspace.empty.sales.step2Title")}</p>
          </div>
          <p className="mt-2 text-[12px] text-[#8E8E93]">
            {t("workspace.empty.sales.step2Desc")}
          </p>
        </div>
        <div className="rounded-[10px] border border-[#2E2E33] bg-[#232327] p-4">
          <div className="flex items-center gap-2 text-[#C7C7CC]">
            <ShopFourTiles className="h-4 w-4 text-[#A8821F]" />
            <p className="text-[13px] font-semibold">{t("workspace.empty.sales.step3Title")}</p>
          </div>
          <p className="mt-2 text-[12px] text-[#8E8E93]">
            {t("workspace.empty.sales.step3Desc")}
          </p>
        </div>
      </div>

      <div className="mt-7">
        <Link
          href="/setup/sales"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#A8821F] px-5 text-sm font-semibold text-[#141416] transition-colors hover:bg-[#B8962E] active:bg-[#8F6F18]"
        >
          {t("workspace.empty.sales.button")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

