"use client";

type ActionRecommendation = {
  action_type: string;
  title: string;
  description: string;
  urgency: "HIGH" | "MEDIUM" | "LOW";
  why: string;
  consequence: string;
  recommended_qty?: number | null;
};

type ActionRecommendationCardProps = {
  action: ActionRecommendation;
  unit: string;
  onAccept?: (recommendedQty?: number) => void;
  disabled?: boolean;
};

export function ActionRecommendationCard({
  action,
  unit,
  onAccept,
  disabled,
}: ActionRecommendationCardProps) {
  const { t } = useTranslation();
  const urgencyStyles = {
    HIGH: "border-status-critical/40 bg-status-critical/8",
    MEDIUM: "border-status-warning/40 bg-status-warning/8",
    LOW: "border-status-success/40 bg-status-success/8",
  };

  const urgencyBadgeStyles = {
    HIGH: "bg-status-critical/20 text-status-critical",
    MEDIUM: "bg-status-warning/20 text-status-warning",
    LOW: "bg-status-success/20 text-status-success",
  };

  const urgencyButtonStyles = {
    HIGH: "border-status-critical/40 bg-status-critical/10 text-status-critical hover:bg-status-critical/20",
    MEDIUM: "border-status-warning/40 bg-status-warning/10 text-status-warning hover:bg-status-warning/20",
    LOW: "border-status-success/40 bg-status-success/10 text-status-success hover:bg-status-success/20",
  };

  const showCTA =
    onAccept &&
    (action.action_type === "ACCEPT_SUGGESTION" ||
      action.action_type === "ADD_BUFFER" ||
      action.action_type === "REDUCE_PREP");

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${urgencyStyles[action.urgency]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${urgencyBadgeStyles[action.urgency]}`}
            >
              {action.urgency}
            </span>
            <p className="text-sm font-semibold text-text-primary">
              {action.title}
            </p>
          </div>
          <p className="text-sm text-text-secondary">{action.description}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] font-semibold text-brand-gold">
              {t("workspace.today.table.whyThisQuantity")}
            </summary>
            <div className="mt-2 space-y-1 text-[11px] text-text-secondary">
              <p>
                <span className="font-semibold text-text-primary">{t("workspace.today.deepDive.whyThisNumber")}: </span>
                {action.why}
              </p>
              <p>
                <span className="font-semibold text-text-primary">
                  {t("workspace.today.table.risk")}:{" "}
                </span>
                {action.consequence}
              </p>
            </div>
          </details>
        </div>
        {showCTA && action.recommended_qty !== undefined && (
          <button
            type="button"
            onClick={() => onAccept?.(action.recommended_qty ?? undefined)}
            disabled={disabled}
            className={`shrink-0 inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${urgencyButtonStyles[action.urgency]}`}
          >
            {t("common.submit")}
          </button>
        )}
      </div>
    </div>
  );
}
