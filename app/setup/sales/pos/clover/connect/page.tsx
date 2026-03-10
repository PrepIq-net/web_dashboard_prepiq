"use client";

import { useMemo, useState } from "react";
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
  useStartCloverOAuth,
} from "@/services/production-intelligence/hooks";

export default function CloverConnectPage() {
  const router = useRouter();
  const { data: scope, isLoading: scopeLoading, error: scopeError } =
    useProductionIntelligenceAccessScope();

  const [branchId, setBranchId] = useState("");
  const cloverOAuth = useStartCloverOAuth();

  const branches = useMemo(() => scope?.accessible_branches ?? [], [scope]);

  const selectedBranchId =
    branchId || scope?.default_branch_id || branches[0]?.id || "";

  async function handleCloverConnect(branchIdOverride?: string) {
    const targetBranchId = branchIdOverride || selectedBranchId;
    if (!targetBranchId) return;

    const popup = window.open("", "_blank");
    if (!popup) {
      return;
    }

    const postConnectRedirect = `${window.location.origin}/setup/sales/pos/clover/connected`;
    try {
      const result = await cloverOAuth.mutateAsync({
        branch_id: targetBranchId,
        post_connect_redirect: postConnectRedirect,
      });

      popup.location.href = result.authorize_url;
    } catch {
      popup.close();
      // error handled by mutation state block below
    }
  }

  function handleBranchSelect(nextBranchId: string) {
    setBranchId(nextBranchId);
    if (!nextBranchId || cloverOAuth.isPending || scopeLoading || scopeError) {
      return;
    }
    void handleCloverConnect(nextBranchId);
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

        <h1 className="font-display text-[32px] leading-[40px] font-semibold text-[#F5F5F7] mb-2">
          Connect Clover POS
        </h1>
        <p className="text-[14px] leading-[22px] text-[#8E8E93] mb-6">
          Authorize PrepIQ to read your orders and merchant data. Selecting a
          branch opens Clover in a new tab.
        </p>

        <div className="rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] p-5 mb-4">
          <div className="flex items-start gap-2.5 mb-4">
            <InfoCircle className="h-4 w-4 text-[#3A6EA5] shrink-0 mt-0.5" />
            <p className="text-[13px] leading-[20px] text-[#C7C7CC]">
              You will be redirected to Clover and then returned here after
              authorization.
            </p>
          </div>

          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93] block mb-2">
            Branch
          </label>

          {scopeLoading ? (
            <div className="h-11 rounded-[8px] border border-[#2E2E33] bg-[#232327] flex items-center px-3 gap-2 text-[#8E8E93] text-sm">
              <Spinner size="sm" color="#8E8E93" />
              Loading accessible branches...
            </div>
          ) : branches.length === 0 ? (
            <div className="rounded-[8px] border border-[#C48B2A]/40 bg-[#C48B2A]/10 p-3 text-[13px] text-[#C7C7CC]">
              No accessible branches found for integration setup.
            </div>
          ) : (
            <Select
              label=""
              options={branches.map((branch) => ({
                value: branch.id,
                label: branch.name,
              }))}
              value={selectedBranchId}
              onChange={handleBranchSelect}
              placeholder="Select branch to connect"
              className="space-y-0"
            />
          )}
        </div>

        {(scopeError || cloverOAuth.error) && (
          <div className="rounded-[12px] border border-[#C44949]/50 bg-[#C44949]/10 p-4 mb-4">
            <div className="flex items-start gap-2.5">
              <WarningTriangle className="h-4 w-4 text-[#C44949] shrink-0 mt-0.5" />
              <p className="text-[13px] leading-[20px] text-[#C7C7CC]">
                {scopeError instanceof Error
                  ? scopeError.message
                  : cloverOAuth.error instanceof Error
                    ? cloverOAuth.error.message
                    : "Unable to start Clover connection."}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={() => {
            void handleCloverConnect();
          }}
          disabled={
            cloverOAuth.isPending || scopeLoading || !selectedBranchId
          }
          className="w-full h-12 bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] disabled:opacity-40 disabled:cursor-not-allowed text-[#141416] text-sm font-semibold rounded-[8px] inline-flex items-center justify-center gap-2 transition-colors"
        >
          {cloverOAuth.isPending ? (
            <>
              <Spinner size="sm" color="#141416" />
              Preparing OAuth...
            </>
          ) : (
            <>
              <ArrowRight className="h-4 w-4" />
              Connect with Clover
            </>
          )}
        </button>
      </div>
    </div>
  );
}
