"use client";

interface ProductionItem {
  id: string;
  item_title: string;
  recommended_quantity: number;
  unit: string;
}

interface TaskItem {
  label: string;
  done: boolean;
}

interface ChefViewProps {
  branchName: string;
  shiftProgress: number;
  currentTimeLabel: string;
  todayRecommendations: ProductionItem[];
  todayPlanTotal: number;
  assignedTasks: TaskItem[];
  completedCount: number;
  totalCount: number;
  operationalWarnings: string[];
  isLoading: boolean;
}

export function ChefView({
  branchName,
  shiftProgress,
  currentTimeLabel,
  todayRecommendations,
  todayPlanTotal,
  assignedTasks,
  completedCount,
  totalCount,
  operationalWarnings,
  isLoading,
}: ChefViewProps) {
  const taskCompletionPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <>
      {/* Header */}
      <div className="mb-12 flex items-start justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
            Production Command
          </p>
          <h1 className="mt-3 font-display text-5xl font-semibold text-text-primary tracking-tight">
            Today&apos;s Production Plan
          </h1>
          <p className="mt-4 text-base text-text-secondary max-w-2xl">
            Operational guidance and task management for{" "}
            {branchName || "your assigned branch"}.
          </p>
        </div>
        <div className="text-right shrink-0 mt-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
            Shift Progress
          </p>
          <p className="mt-1 font-display text-3xl font-semibold text-brand-gold">
            {shiftProgress.toFixed(0)}%
          </p>
          <p className="text-sm text-text-muted mt-0.5">{currentTimeLabel}</p>
        </div>
      </div>

      {/* Production Schedule */}
      <section className="mb-10">
        <div className="bg-surface-2 rounded-card border border-surface-4/50 overflow-hidden">
          <div className="px-8 py-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                Production Schedule
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-text-primary">
                Items to Prepare
              </h2>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-text-secondary">
                {todayRecommendations.length} items planned
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                Total: {todayPlanTotal.toLocaleString()} units
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="px-8 py-12 flex items-center justify-center text-text-muted gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
              Loading today&apos;s production command…
            </div>
          ) : todayRecommendations.length ? (
            <div className="divide-y divide-surface-4">
              {todayRecommendations.slice(0, 10).map((item, index) => {
                const isHighPriority = index < 3;
                const isMedPriority = index < 7;
                const priorityLabel = isHighPriority
                  ? "High"
                  : isMedPriority
                    ? "Medium"
                    : "Standard";
                const priorityCls = isHighPriority
                  ? "bg-status-critical/15 text-status-critical"
                  : isMedPriority
                    ? "bg-status-warning/15 text-status-warning"
                    : "bg-surface-4 text-text-muted";

                return (
                  <div
                    key={item.id}
                    className="px-8 py-5 flex items-center justify-between hover:bg-surface-3/40 transition-colors duration-150"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-brand-gold/15 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-brand-gold">{index + 1}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary text-base truncate">
                          {item.item_title}
                        </p>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${priorityCls}`}
                        >
                          {priorityLabel} Priority
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="font-display text-2xl font-semibold text-text-primary">
                        {item.recommended_quantity}
                      </p>
                      <p className="text-sm text-text-muted">{item.unit}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-8 py-12 text-center">
              <p className="text-text-muted">No production command generated yet</p>
              <p className="text-sm text-text-disabled mt-1">Check back in a few minutes</p>
            </div>
          )}
        </div>
      </section>

      {/* Tasks + Shift Info */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assigned Tasks */}
        <article className="bg-surface-2 rounded-card p-8 border border-surface-4/50">
          <div className="mb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Task Management
            </p>
            <h2 className="mt-2 font-display text-xl font-semibold text-text-primary">
              Assigned Tasks
            </h2>
          </div>

          <div className="space-y-2">
            {assignedTasks.length ? (
              assignedTasks.map((task) => (
                <div
                  key={task.label}
                  className="flex items-center justify-between p-4 bg-surface-3 rounded-xl hover:bg-surface-4/50 transition-colors duration-150"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        task.done ? "bg-status-success" : "bg-status-warning"
                      }`}
                    />
                    <p className="text-sm font-medium text-text-primary capitalize truncate">
                      {task.label}
                    </p>
                  </div>
                  <span
                    className={`ml-3 shrink-0 inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                      task.done
                        ? "bg-status-success/15 text-status-success"
                        : "bg-status-warning/15 text-status-warning"
                    }`}
                  >
                    {task.done ? "Done" : "Pending"}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-text-muted">No assigned tasks yet</p>
                <p className="text-sm text-text-disabled mt-1">
                  Tasks will appear as they are assigned
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-surface-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-text-secondary">Task Completion</p>
              <span className="text-sm font-semibold text-text-primary">
                {completedCount}/{totalCount}
              </span>
            </div>
            <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
              <div
                className="h-2 bg-status-success rounded-full transition-all duration-500"
                style={{ width: `${taskCompletionPct}%` }}
              />
            </div>
          </div>
        </article>

        {/* Shift Info */}
        <article className="bg-surface-2 rounded-card p-8 border border-surface-4/50">
          <div className="mb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Shift Information
            </p>
            <h2 className="mt-2 font-display text-xl font-semibold text-text-primary">
              Current Status
            </h2>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-5 bg-surface-3 rounded-xl text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-2">
                  Current Time
                </p>
                <p className="font-display text-2xl font-semibold text-text-primary">
                  {currentTimeLabel}
                </p>
              </div>
              <div className="p-5 bg-surface-3 rounded-xl text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-2">
                  Shift Progress
                </p>
                <p className="font-display text-2xl font-semibold text-brand-gold">
                  {shiftProgress.toFixed(0)}%
                </p>
              </div>
            </div>

            <div className="p-5 bg-surface-3 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-text-secondary">Shift Timeline</p>
                <p className="text-xs text-text-muted">6:00 AM – 10:00 PM</p>
              </div>
              <div className="h-2.5 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-gold rounded-full transition-all duration-500"
                  style={{ width: `${shiftProgress}%` }}
                />
              </div>
            </div>

            <div className="p-5 bg-surface-3 rounded-xl">
              <p className="text-sm font-medium text-text-secondary mb-3">
                Operational Warnings
              </p>
              {operationalWarnings.length ? (
                <div className="space-y-2">
                  {operationalWarnings.map((warning, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-status-warning mt-1.5 shrink-0" />
                      <p className="text-sm text-status-warning leading-snug">{warning}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-status-success">No active operational warnings</p>
              )}
            </div>
          </div>
        </article>
      </section>
    </>
  );
}
