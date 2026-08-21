"use client";

import { useState } from "react";
import { Send } from "iconoir-react";
import { DrawerShell } from "@/components/ui/drawer-shell";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "@/lib/i18n";
import { useAskOrgQuery } from "@/services/insights/hooks";

type Turn = { question: string; answer: string };

/**
 * "How are my restaurants doing" — task.md's Meeting/Management Agent, one
 * question at a time. Deliberately not a real chat thread: each turn is its
 * own stateless call (see insights.services.org_analyst) and no history is
 * sent back with the next question, so this stays a local list of
 * question/answer pairs for display only, not a conversation the backend
 * remembers.
 */
export function OrgAskDrawer({
  open,
  onClose,
  organizationId,
}: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
}) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const ask = useAskOrgQuery(organizationId);

  const handleAsk = () => {
    const text = question.trim();
    if (!text || ask.isPending) return;
    ask.mutate(text, {
      onSuccess: (data) => {
        setTurns((prev) => [...prev, { question: text, answer: data.answer }]);
        setQuestion("");
      },
    });
  };

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      title={t("dashboard.orgAsk.title")}
      description={t("dashboard.orgAsk.description")}
      widthClassName="w-[480px]"
    >
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 scrollbar-thin">
          {turns.length === 0 ? (
            <p className="text-sm text-text-muted">{t("dashboard.orgAsk.empty")}</p>
          ) : (
            turns.map((turn, i) => (
              <div key={i} className="space-y-1.5">
                <p className="text-sm font-medium text-text-primary">{turn.question}</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                  {turn.answer}
                </p>
              </div>
            ))
          )}
          {ask.isPending ? (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Spinner /> {t("dashboard.orgAsk.thinking")}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-end gap-2 border-t border-surface-4/60 pt-4">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
            placeholder={t("dashboard.orgAsk.placeholder")}
            rows={2}
            className="min-h-11 flex-1 resize-none rounded-lg border border-surface-4 bg-surface-3 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-gold/60 focus:outline-none focus:ring-1 focus:ring-brand-gold/30"
          />
          <button
            type="button"
            onClick={handleAsk}
            disabled={!question.trim() || ask.isPending}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-gold text-surface-1 transition-opacity hover:opacity-90 disabled:opacity-50"
            aria-label={t("dashboard.orgAsk.send")}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </DrawerShell>
  );
}
