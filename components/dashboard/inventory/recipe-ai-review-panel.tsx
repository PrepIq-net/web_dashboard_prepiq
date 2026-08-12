"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SparksSolid } from "iconoir-react";
import { PendingActionConfirm } from "@/components/assistant/pending-action-confirm";
import { useConfirmAssistantAction, useRunRecipeReview } from "@/services/assistant/hooks";
import { inventoryQueryKeys } from "@/services/inventory/hooks";
import type { CommandProposal } from "@/services/assistant/types";

type ResolvedState = "applied" | "declined" | "failed";

/**
 * "Ask AI to review this recipe" — diagnoses ingredient quantities and the
 * photo (recipe_review.py, a fixed set of checks, no free-form model
 * reasoning about what to change) and returns proposals. Each renders as
 * the same confirm/dismiss card the assistant chat and command palette
 * already use — nothing is written until a chef with recipe permission taps
 * Confirm, and it goes through the exact same confirm-gated action pipeline.
 */
export function RecipeAiReviewPanel({
  branchId,
  menuItemId,
}: {
  branchId: string;
  menuItemId: string;
}) {
  const queryClient = useQueryClient();
  const reviewMutation = useRunRecipeReview();
  const confirmMutation = useConfirmAssistantAction();

  const [proposals, setProposals] = useState<CommandProposal[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [resolvedById, setResolvedById] = useState<Record<string, ResolvedState>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const disabled = !branchId || !menuItemId;

  const runReview = (scope: "full" | "image") => {
    if (disabled) return;
    setMessage(null);
    reviewMutation.mutate(
      { branch_id: branchId, menu_item_id: menuItemId, scope },
      {
        onSuccess: (data) => {
          setProposals(data.proposals);
          setResolvedById({});
          if (!data.proposals.length) {
            setMessage(
              data.message || "This recipe looks sound — nothing to propose right now.",
            );
          }
        },
      },
    );
  };

  const resolve = (proposal: CommandProposal, applied: boolean) => {
    setBusyId(proposal.message_id);
    confirmMutation.mutate(
      {
        conversationId: proposal.conversation_id,
        payload: { applied, message_id: proposal.message_id },
      },
      {
        onSuccess: (outcome) => {
          setBusyId(null);
          setResolvedById((prev) => ({
            ...prev,
            [proposal.message_id]: outcome.applied
              ? "applied"
              : applied
                ? "failed"
                : "declined",
          }));
          if (outcome.applied) {
            // Belt-and-suspenders with the realtime broadcast (which reaches
            // every OTHER open tab): this tab already has the mutation
            // result, so refresh its own queries immediately too.
            queryClient.invalidateQueries({
              queryKey: inventoryQueryKeys.recipes(menuItemId),
            });
            queryClient.invalidateQueries({
              queryKey: inventoryQueryKeys.menuItems(branchId),
            });
          }
        },
        onError: () => {
          setBusyId(null);
          setResolvedById((prev) => ({ ...prev, [proposal.message_id]: "failed" }));
        },
      },
    );
  };

  return (
    <div className="rounded-xl border border-surface-4 bg-surface-2 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            AI Review
          </p>
          <h3 className="mt-0.5 font-display text-lg font-semibold text-text-primary">
            Ask AI to review this recipe
          </h3>
        </div>
        <SparksSolid className="h-5 w-5 shrink-0 text-brand-gold" />
      </div>
      <p className="mt-2 text-xs text-text-secondary">
        Checks ingredient quantities and the photo, and proposes fixes —
        nothing changes until you approve each one.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => runReview("full")}
          disabled={disabled || reviewMutation.isPending}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-gold px-3 text-xs font-semibold text-surface-1 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {reviewMutation.isPending ? "Reviewing…" : "Ask AI to review"}
        </button>
        <button
          type="button"
          onClick={() => runReview("image")}
          disabled={disabled || reviewMutation.isPending}
          className="inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-secondary transition-colors hover:border-brand-gold/50 hover:text-brand-gold disabled:cursor-not-allowed disabled:opacity-60"
        >
          Regenerate photo only
        </button>
      </div>

      {reviewMutation.isError ? (
        <p className="mt-3 text-xs text-status-critical">
          Couldn&apos;t run the review — try again.
        </p>
      ) : null}

      {message ? <p className="mt-4 text-sm text-status-success">{message}</p> : null}

      {proposals.length > 0 ? (
        <div className="mt-4 space-y-2">
          {proposals.map((proposal) => {
            const resolved = resolvedById[proposal.message_id];
            if (resolved === "applied") {
              return (
                <p key={proposal.message_id} className="text-sm text-status-success">
                  Applied — {proposal.summary}
                </p>
              );
            }
            if (resolved === "declined") {
              return (
                <p key={proposal.message_id} className="text-sm text-text-muted">
                  Dismissed — {proposal.summary}
                </p>
              );
            }
            if (resolved === "failed") {
              return (
                <p key={proposal.message_id} className="text-sm text-status-critical">
                  Couldn&apos;t apply — {proposal.summary}
                </p>
              );
            }
            return (
              <PendingActionConfirm
                key={proposal.message_id}
                action={proposal.pending_action}
                busy={busyId === proposal.message_id}
                onConfirm={() => resolve(proposal, true)}
                onDismiss={() => resolve(proposal, false)}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
