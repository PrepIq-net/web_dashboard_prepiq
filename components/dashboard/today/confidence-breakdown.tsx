"use client";

type ConfidenceBreakdownProps = {
  dataQualityScore: number;
  historicalAccuracyScore: number;
  signalReliabilityScore: number;
  patternValidationScore: number;
  confidenceFactors: string[];
};

function scoreColor(score: number) {
  if (score >= 0.75) return "bg-status-success";
  if (score >= 0.50) return "bg-status-warning";
  return "bg-status-critical";
}

function scoreLabel(score: number) {
  if (score >= 0.75) return "Strong";
  if (score >= 0.50) return "Moderate";
  return "Weak";
}

export function ConfidenceBreakdown({
  dataQualityScore,
  historicalAccuracyScore,
  signalReliabilityScore,
  patternValidationScore,
  confidenceFactors,
}: ConfidenceBreakdownProps) {
  const components = [
    {
      label: "Data Quality",
      score: dataQualityScore,
      description: "How much history we have",
    },
    {
      label: "Historical Accuracy",
      score: historicalAccuracyScore,
      description: "How stable demand has been",
    },
    {
      label: "Signal Reliability",
      score: signalReliabilityScore,
      description: "How aligned our signals are",
    },
    {
      label: "Pattern Validation",
      score: patternValidationScore,
      description: "Cross-branch pattern support",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {components.map((component) => (
          <div
            key={component.label}
            className="rounded-lg border border-surface-4 bg-surface-3/35 px-3 py-3"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                {component.label}
              </p>
              <span
                className={`text-xs font-semibold ${
                  component.score >= 0.75
                    ? "text-status-success"
                    : component.score >= 0.50
                      ? "text-status-warning"
                      : "text-status-critical"
                }`}
              >
                {scoreLabel(component.score)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-4">
              <div
                className={`h-full rounded-full transition-all ${scoreColor(component.score)}`}
                style={{ width: `${component.score * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-text-muted">
              {component.description}
            </p>
          </div>
        ))}
      </div>

      {confidenceFactors.length > 0 && (
        <div className="rounded-lg border border-surface-4 bg-surface-3/35 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-2">
            What affects this score
          </p>
          <ul className="space-y-1.5">
            {confidenceFactors.map((factor, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-[11px] text-text-secondary"
              >
                <span className="mt-0.5 shrink-0">{factor.charAt(0)}</span>
                <span>{factor.slice(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
