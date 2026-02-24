import { notFound } from "next/navigation";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";

type SectionDefinition = {
  eyebrow: string;
  title: string;
  description: string;
  insight: string;
  metrics: Array<{ label: string; value: string; note?: string }>;
  bullets: string[];
};

const SECTION_DEFINITIONS: Record<string, SectionDefinition> = {
  "margin-protection": {
    eyebrow: "Financial Intelligence",
    title: "Margin Protection",
    description: "Track leakage signals and money protected by forecast discipline.",
    insight: "Margin volatility is concentrated in two branches; tighten override controls there first.",
    metrics: [
      { label: "Protected this week", value: "$2,480" },
      { label: "Leakage risk", value: "4.2%" },
      { label: "Branches at risk", value: "2", note: "Needs review today" },
    ],
    bullets: [
      "Top leakage source: overproduction on pastries after 5pm.",
      "Branch South has the highest mismatch between prep and sales.",
      "Auto-actions: stricter confidence threshold for low-history items.",
    ],
  },
  "waste-cost-report": {
    eyebrow: "Financial Intelligence",
    title: "Waste Cost Report",
    description: "Daily and weekly waste cost trend with branch-level accountability.",
    insight: "Waste cost dropped 9% week over week after shift-level checklist enforcement.",
    metrics: [
      { label: "Today waste", value: "$418" },
      { label: "7-day average", value: "$503" },
      { label: "Best branch", value: "City Center", note: "2.1% waste rate" },
    ],
    bullets: [
      "Muffin and croissant drive 38% of waste cost.",
      "Two branches improved prep adherence over 90% today.",
      "Flagged SKU set ready for forecast retraining.",
    ],
  },
  "tax-engine": {
    eyebrow: "Financial Intelligence",
    title: "Tax Engine",
    description: "Certificate, filing, and compliance automation status across branches.",
    insight: "Tax certificate automation is ready for pilot in two low-risk branches.",
    metrics: [
      { label: "Automation status", value: "Pilot Ready" },
      { label: "Certificates synced", value: "5 / 5" },
      { label: "Compliance alerts", value: "0" },
    ],
    bullets: [
      "Next action: connect authority endpoint credentials.",
      "Historical invoice consistency checks passed.",
      "No missing certificate records detected this cycle.",
    ],
  },
  "purchase-variance": {
    eyebrow: "Financial Intelligence",
    title: "Purchase Variance",
    description: "Supplier price movement and procurement anomalies that impact margin.",
    insight: "Supplier A butter price jumped 14%; lock short-term substitute contracts now.",
    metrics: [
      { label: "Anomalies", value: "3" },
      { label: "Highest swing", value: "+14%" },
      { label: "Impact estimate", value: "$690 / month" },
    ],
    bullets: [
      "Dairy line items show the largest variance this month.",
      "Two suppliers are consistently above contracted range.",
      "Recommended: rebalance purchase mix for next 2 weeks.",
    ],
  },
  "branch-financial-summary": {
    eyebrow: "Financial Intelligence",
    title: "Branch Financial Summary",
    description: "Side-by-side branch financial performance and risk indicators.",
    insight: "Branch Downtown leads on margin reliability and should be the process baseline.",
    metrics: [
      { label: "Tracked branches", value: "5" },
      { label: "Avg margin signal", value: "Stable" },
      { label: "Outlier branches", value: "1" },
    ],
    bullets: [
      "Downtown: strongest waste-to-revenue ratio.",
      "North branch shows recurring stockout loss pattern.",
      "One-click branch drill-down will be wired next.",
    ],
  },
  branches: {
    eyebrow: "Operations",
    title: "Branches",
    description: "Operational branch list, current health, and setup status.",
    insight: "Two branches need staffing rebalance during afternoon peak windows.",
    metrics: [
      { label: "Total branches", value: "5" },
      { label: "Healthy branches", value: "4" },
      { label: "Action needed", value: "1" },
    ],
    bullets: [
      "Branch North has delayed batch logging.",
      "All branches have active data feed configured.",
      "Primary branch remains Downtown Bakery.",
    ],
  },
  "production-intelligence": {
    eyebrow: "Operations",
    title: "Production Intelligence",
    description: "Forecast quality, command compliance, and production risk trends.",
    insight: "Forecast confidence is strongest for items with 14+ days of clean sales history.",
    metrics: [
      { label: "Forecast accuracy", value: "88.4%" },
      { label: "Commands today", value: "64" },
      { label: "Overrides", value: "7" },
    ],
    bullets: [
      "Override concentration is mostly in one branch.",
      "Stockout risk improved after latest prep policy.",
      "Model confidence improved vs previous week.",
    ],
  },
  "purchase-intelligence": {
    eyebrow: "Operations",
    title: "Purchase Intelligence",
    description: "Purchase planning and cost-control signals tied to production demand.",
    insight: "Aligning purchase cadence to forecast windows can reduce waste by another 6-8%.",
    metrics: [
      { label: "Coverage window", value: "9 days" },
      { label: "At-risk SKUs", value: "6" },
      { label: "Price signals", value: "3" },
    ],
    bullets: [
      "Butter, milk, and flour require variance controls.",
      "Two SKUs overstocked relative to demand curve.",
      "Procurement playbook update ready for rollout.",
    ],
  },
  "staff-performance": {
    eyebrow: "Operations",
    title: "Staff Performance",
    description: "Branch-by-branch execution quality and shift-level accountability.",
    insight: "Morning shift in Branch South is outperforming evening shift by 18 points.",
    metrics: [
      { label: "Active staff", value: "27" },
      { label: "Avg compliance", value: "91%" },
      { label: "High performers", value: "9" },
    ],
    bullets: [
      "Best team consistency recorded in Downtown branch.",
      "One branch needs coaching on override decisions.",
      "Checklist completion rate is above weekly baseline.",
    ],
  },
  "branch-performance": {
    eyebrow: "Executive",
    title: "Branch Performance",
    description: "Cross-branch ranking for waste, sales conversion, and prep quality.",
    insight: "Branch Central is trending down on waste but still under target conversion.",
    metrics: [
      { label: "Top branch", value: "Downtown" },
      { label: "Lowest waste", value: "2.1%" },
      { label: "Avg conversion", value: "84%" },
    ],
    bullets: [
      "North branch needs immediate inventory cadence tuning.",
      "Central branch has best compliance recovery trajectory.",
      "Weekly ranking uses weighted margin + waste signals.",
    ],
  },
  "staff-intelligence": {
    eyebrow: "Executive",
    title: "Staff Intelligence",
    description: "People-level performance view connected to operational outcomes.",
    insight: "Teams with the highest command adherence also have the lowest waste leakage.",
    metrics: [
      { label: "Teams monitored", value: "8" },
      { label: "Avg quality score", value: "89" },
      { label: "Alerts", value: "2" },
    ],
    bullets: [
      "Coach focus: late-shift variance decisions.",
      "Scorecard weighting updated for forecast accuracy.",
      "Promotion candidates flagged by consistency trend.",
    ],
  },
  "risk-compliance": {
    eyebrow: "Executive",
    title: "Risk & Compliance",
    description: "Operational risk posture, policy adherence, and compliance alerts.",
    insight: "No high-severity compliance issues found in the current reporting window.",
    metrics: [
      { label: "Open risks", value: "4" },
      { label: "High severity", value: "0" },
      { label: "Resolved this week", value: "6" },
    ],
    bullets: [
      "Main risk bucket is demand volatility, not process breach.",
      "Audit trail completeness is above 98%.",
      "Compliance checklist sync completed for all branches.",
    ],
  },
  "production-plan": {
    eyebrow: "Branch Workspace",
    title: "Production Plan",
    description: "Branch-level production plan, prioritized by demand and confidence.",
    insight: "Croissant and muffin prep should be front-loaded before 10am.",
    metrics: [
      { label: "Planned items", value: "18" },
      { label: "High priority", value: "6" },
      { label: "At-risk items", value: "2" },
    ],
    bullets: [
      "Follow confidence tier when deciding overrides.",
      "Low-history items require conservative buffers.",
      "Late-day production should be cut by 12%.",
    ],
  },
  "sales-waste": {
    eyebrow: "Branch Workspace",
    title: "Sales & Waste",
    description: "Operational sales outcomes against prepared volume and waste cost.",
    insight: "Yesterday variance suggests reducing end-of-day prep by 10 units on pastries.",
    metrics: [
      { label: "Prepared", value: "1,240" },
      { label: "Sold", value: "1,122" },
      { label: "Waste cost", value: "$74" },
    ],
    bullets: [
      "Two SKUs are repeatedly overproduced.",
      "Sales recovery strongest in beverage category.",
      "Close-of-day variance tracking is stable.",
    ],
  },
  inventory: {
    eyebrow: "Branch Workspace",
    title: "Inventory",
    description: "Branch stock coverage, risk of stockout, and replenishment focus areas.",
    insight: "Flour and milk coverage is below optimal threshold for next 48 hours.",
    metrics: [
      { label: "Tracked SKUs", value: "86" },
      { label: "Low stock", value: "7" },
      { label: "Critical", value: "2" },
    ],
    bullets: [
      "Replenish milk before next morning cycle.",
      "Buffer stock on butter is now healthy.",
      "One supplier lead-time anomaly detected.",
    ],
  },
  staff: {
    eyebrow: "Branch Workspace",
    title: "Staff",
    description: "Branch staffing load, roles, and active shift readiness signals.",
    insight: "Current headcount is sufficient for planned production volume today.",
    metrics: [
      { label: "On shift", value: "11" },
      { label: "Managers", value: "2" },
      { label: "Coverage gaps", value: "0" },
    ],
    bullets: [
      "Morning prep team remains the strongest performer.",
      "Cross-training opportunity identified for new hires.",
      "No shift capacity risk detected.",
    ],
  },
  "log-batch": {
    eyebrow: "Production",
    title: "Log Batch",
    description: "Record prepared batches quickly and keep execution traceable.",
    insight: "Batch log timeliness is strongly correlated with lower variance.",
    metrics: [
      { label: "Batches today", value: "23" },
      { label: "Late logs", value: "1" },
      { label: "Avg log delay", value: "6 min" },
    ],
    bullets: [
      "Most logs are submitted within expected window.",
      "One delayed log from the afternoon shift.",
      "Ready for barcode-assisted logging integration.",
    ],
  },
  history: {
    eyebrow: "Production",
    title: "History",
    description: "Recent production execution history and quality trend snapshots.",
    insight: "Command adherence has improved for three consecutive days.",
    metrics: [
      { label: "Last 7 days", value: "168 batches" },
      { label: "Avg adherence", value: "92%" },
      { label: "Variance trend", value: "Down" },
    ],
    bullets: [
      "Variance is stabilizing around target threshold.",
      "Largest improvement came from reduced late prep.",
      "History panel ready for advanced filters.",
    ],
  },
  chat: {
    eyebrow: "Collaboration",
    title: "Team Chat",
    description: "Operational collaboration space for branch and organization teams.",
    insight: "Create a daily command thread per branch to reduce decision latency.",
    metrics: [
      { label: "Active rooms", value: "6" },
      { label: "Unread mentions", value: "4" },
      { label: "Escalations", value: "1" },
    ],
    bullets: [
      "Pinned: daily production command summary.",
      "Pinned: supplier anomaly incident runbook.",
      "Chat integrations will be wired to alerts soon.",
    ],
  },
  settings: {
    eyebrow: "System",
    title: "Settings",
    description: "Workspace configuration, access controls, and platform preferences.",
    insight: "Enable branch-level default context to reduce navigation friction for operators.",
    metrics: [
      { label: "Access profiles", value: "5" },
      { label: "MFA coverage", value: "100%" },
      { label: "Pending changes", value: "2" },
    ],
    bullets: [
      "Profile and organization settings are healthy.",
      "Audit logs are retained and searchable.",
      "Role-based defaults are now ready for rollout.",
    ],
  },
  support: {
    eyebrow: "System",
    title: "Support",
    description: "Help center, issue tracking, and implementation assistance.",
    insight: "Most onboarding blockers are integration-related and resolved within 24h.",
    metrics: [
      { label: "Open tickets", value: "2" },
      { label: "Avg response", value: "18 min" },
      { label: "Resolved this week", value: "11" },
    ],
    bullets: [
      "Priority support is active for production blockers.",
      "Implementation docs are versioned and up to date.",
      "Share branch ID when opening data-quality tickets.",
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(SECTION_DEFINITIONS).map((section) => ({ section }));
}

export default async function WorkspaceSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const definition = SECTION_DEFINITIONS[section];

  if (!definition) {
    notFound();
  }

  return (
    <WorkspaceShell
      eyebrow={definition.eyebrow}
      title={definition.title}
      description={definition.description}
      insight={definition.insight}
    >
      <section className="grid grid-cols-1 gap-5 md:grid-cols-3 pb-8 border-b border-[#2A2A2E]">
        {definition.metrics.map((metric) => (
          <article key={metric.label}>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
              {metric.label}
            </p>
            <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
              {metric.value}
            </p>
            {metric.note ? (
              <p className="mt-1 text-[12px] text-[#8E8E93]">{metric.note}</p>
            ) : null}
          </article>
        ))}
      </section>

      <section className="mt-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
          Operational Highlights
        </p>
        <div className="mt-3 space-y-2">
          {definition.bullets.map((item) => (
            <p key={item} className="text-[14px] text-[#C7C7CC]">
              • {item}
            </p>
          ))}
        </div>
      </section>
    </WorkspaceShell>
  );
}
