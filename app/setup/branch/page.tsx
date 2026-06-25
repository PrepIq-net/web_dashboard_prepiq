"use client";

import { useRouter } from "next/navigation";
import { Building, ArrowRight, Check, Sparks } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";

export default function BranchSetupPromptPage() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Status badge */}
        <div className="flex items-center gap-2 mb-10">
          <span className="h-5 w-5 rounded-full bg-[#3F8F68]/20 flex items-center justify-center">
            <Check className="h-3 w-3 text-[#3F8F68]" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3F8F68]">
            {t("setup.branchPrompt.orgCreated")}
          </span>
        </div>

        {/* Headline */}
        <h1
          className="font-display text-[40px] leading-[48px] font-semibold text-[#F5F5F7] mb-3"
          dangerouslySetInnerHTML={{
            __html: t("setup.branchPrompt.title").replace(
              "your first",
              "your<br />first",
            ),
          }}
        />
        <p className="text-[16px] leading-[24px] text-[#8E8E93] mb-8 max-w-sm">
          {t("setup.branchPrompt.description")}
        </p>

        {/* Intelligence Trial callout */}
        <div className="rounded-[12px] border border-[#A8821F]/30 bg-[#A8821F]/6 px-5 py-4 mb-8 flex items-start gap-4">
          <span className="h-8 w-8 rounded-[8px] bg-[#A8821F]/15 flex items-center justify-center shrink-0 mt-0.5">
            <Sparks className="h-4 w-4 text-[#A8821F]" />
          </span>
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#A8821F] mb-1">
              30-Day Intelligence Trial — Free
            </p>
            <p className="text-[13px] leading-[20px] text-[#C7C7CC]">
              Your first branch unlocks the full Intelligence plan: AI
              forecasting, waste attribution, margin protection, and executive
              reports — at no cost for 30 days.
            </p>
          </div>
        </div>

        {/* Visual divider */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-px flex-1 bg-[#2E2E33]" />
          <Building className="h-4 w-4 text-[#5A5A60]" />
          <div className="h-px flex-1 bg-[#2E2E33]" />
        </div>

        {/* What you'll set up */}
        <ul className="space-y-3 mb-10">
          {[
            t("setup.branch.nameLabel"),
            t("setup.branch.addressLabel"),
            t("setup.branch.timezoneLabel"),
            t("setup.branchPrompt.operatingDays"),
          ].map((item) => (
            <li
              key={item}
              className="flex items-center gap-3 text-[14px] text-[#C7C7CC]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#A8821F] shrink-0" />
              {item}
            </li>
          ))}
        </ul>

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => router.push("/setup/branch/create")}
            className="w-full h-12 bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] text-[#141416] text-sm font-semibold rounded-[8px] flex items-center justify-center gap-2 transition-colors duration-150"
          >
            {t("setup.branchPrompt.submit")}
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            onClick={() => router.push("/")}
            className="w-full h-12 text-[#5A5A60] hover:text-[#8E8E93] text-sm font-medium transition-colors duration-150"
          >
            {t("setup.branch.skip")}
          </button>
        </div>
      </div>
    </div>
  );
}
