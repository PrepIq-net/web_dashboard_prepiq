"use client";

interface StatBadgeProps {
  status: "completed" | "in-progress" | "at-risk" | "delayed";
  label: string;
}

const statusStyles = {
  completed:
    "bg-status-success/10 text-status-success border-status-success/20",
  "in-progress": "bg-brand-gold/10 text-brand-gold border-brand-gold/20",
  "at-risk":
    "bg-status-warning/10 text-status-warning border-status-warning/20",
  delayed:
    "bg-status-critical/10 text-status-critical border-status-critical/20",
};

export function StatBadge({ status, label }: StatBadgeProps) {
  return (
    <span
      className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${statusStyles[status]}`}
    >
      {label}
    </span>
  );
}
