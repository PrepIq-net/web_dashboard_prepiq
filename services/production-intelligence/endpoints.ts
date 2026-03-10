const BASE = "/api";

export const productionIntelligenceEndpoints = {
  // ── Access & Scope ────────────────────────────────────────────────────────
  accessScope: () => `${BASE}/production-intelligence/access-scope/`,

  // ── Home / Executive Views ────────────────────────────────────────────────
  controlTower: () => `${BASE}/production-intelligence/home/control-tower/`,
  branchCommand: () => `${BASE}/production-intelligence/home/branch-command/`,
  branchCommandStaffAction: () =>
    `${BASE}/production-intelligence/home/branch-command/staff-action/`,

  // ── Recommendations ──────────────────────────────────────────────────────
  todayRecommendations: () =>
    `${BASE}/production-intelligence/recommendations/today/`,
  branchDayInitialize: () =>
    `${BASE}/production-intelligence/branch-day/initialize/`,
  branchDayToday: () => `${BASE}/production-intelligence/branch-day/today/`,
  branchDayStatus: (branchDayId: string) =>
    `${BASE}/production-intelligence/branch-day/${branchDayId}/status/`,
  branchDayLockPlan: (branchDayId: string) =>
    `${BASE}/production-intelligence/branch-day/${branchDayId}/lock-plan/`,
  branchDayAlertIgnore: (branchDayId: string) =>
    `${BASE}/production-intelligence/branch-day/${branchDayId}/alerts/ignore/`,
  prepPlanEvaluate: () => `${BASE}/production-intelligence/prep-plan/evaluate/`,
  prepPlanDetail: (prepPlanItemId: string) =>
    `${BASE}/production-intelligence/prep-plan/${prepPlanItemId}/`,
  productionLogCreate: () => `${BASE}/production-intelligence/production-log/`,
  generateForecast: () =>
    `${BASE}/production-intelligence/recommendations/generate/`,
  recommendationDecision: (recommendationId: string) =>
    `${BASE}/production-intelligence/recommendations/${recommendationId}/decision/`,

  // ── Operations Views ─────────────────────────────────────────────────────
  operationsProduction: () =>
    `${BASE}/production-intelligence/operations/production/`,
  operationsSurplus: () =>
    `${BASE}/production-intelligence/operations/surplus/`,
  operationsLiveSignals: () =>
    `${BASE}/production-intelligence/operations/live-signals/`,
  operationsHealth: () => `${BASE}/production-intelligence/operations/health/`,
  operationsMidServiceRecalc: () =>
    `${BASE}/production-intelligence/operations/mid-service-recalc/`,
  operationsUnmappedSales: () =>
    `${BASE}/production-intelligence/operations/unmapped-sales/`,

  // ── Owner Reports ────────────────────────────────────────────────────────
  ownerDailyPerformance: () =>
    `${BASE}/production-intelligence/owner/daily-performance/`,
  ownerDailyMarginProtection: () =>
    `${BASE}/production-intelligence/owner/daily-margin-protection-report/`,
  ownerDailyMarginProtectionExport: (format: string) =>
    `${BASE}/production-intelligence/owner/daily-margin-protection-report.${format}/`,
  ownerBehavioralKPI: () =>
    `${BASE}/production-intelligence/owner/behavioral-kpi-summary/`,
  ownerPredictiveDrift: () =>
    `${BASE}/production-intelligence/owner/predictive-drift/`,
  ownerPurchaseOptimizer: () =>
    `${BASE}/production-intelligence/owner/purchase-optimizer/`,
  ownerCentralProcurement: () =>
    `${BASE}/production-intelligence/owner/central-procurement-visibility/`,
  ownerStrategicIntelligence: () =>
    `${BASE}/production-intelligence/owner/strategic-intelligence/`,
  ownerNetworkIntelligenceInsights: () =>
    `${BASE}/production-intelligence/owner/network-intelligence-insights/`,
  ownerLiabilityShield: () =>
    `${BASE}/production-intelligence/owner/liability-shield/`,
  ownerInsuranceIntegration: () =>
    `${BASE}/production-intelligence/owner/insurance-integration/`,
  ownerSupplierAnomalies: () =>
    `${BASE}/production-intelligence/owner/supplier-anomalies/`,

  // ── Staff Views ──────────────────────────────────────────────────────────
  staffPersonalDashboard: () =>
    `${BASE}/production-intelligence/staff/personal-dashboard/`,
  staffShiftChecklist: () =>
    `${BASE}/production-intelligence/staff/shift-checklist/`,
  staffStockoutEvents: () =>
    `${BASE}/production-intelligence/staff/stockout-events/`,
  staffDashboardTelemetry: () =>
    `${BASE}/production-intelligence/staff/personal-dashboard/telemetry/`,
  staffAccountability: () =>
    `${BASE}/production-intelligence/owner/staff-accountability/`,

  // ── Sales Data ───────────────────────────────────────────────────────────
  posCSVImport: () => `${BASE}/production-intelligence/sales/import-csv/`,
  posCSVTemplate: () =>
    `${BASE}/production-intelligence/sales/import-csv/template/`,
  posEmailImport: () =>
    `${BASE}/production-intelligence/sales/import-email-report/`,
  posInboundEmail: () => `${BASE}/production-intelligence/sales/inbound-email/`,
  salesDataValidation: () =>
    `${BASE}/production-intelligence/sales/data-validation/`,
  setupForecastWOW: () => `${BASE}/production-intelligence/setup/forecast-wow/`,
  salesManualQuickEntry: () =>
    `${BASE}/production-intelligence/sales/manual-quick-entry/`,

  // ── Integrations ─────────────────────────────────────────────────────────
  integrationsOverview: () =>
    `${BASE}/production-intelligence/integrations/overview/`,
  integrationsSyncRetry: () =>
    `${BASE}/production-intelligence/integrations/retry-sync/`,
  squareOAuthStart: () =>
    `${BASE}/production-intelligence/integrations/square/oauth/start/`,
  squareOAuthCallback: () =>
    `${BASE}/production-intelligence/integrations/square/oauth/callback/`,
  squarePOSWebhook: () => `${BASE}/production-intelligence/webhooks/square/`,
  toastOAuthStart: () =>
    `${BASE}/production-intelligence/integrations/toast/oauth/start/`,
  toastPOSWebhook: () => `${BASE}/production-intelligence/webhooks/toast/`,
  loyverseOAuthStart: () =>
    `${BASE}/production-intelligence/integrations/loyverse/oauth/start/`,
  loyverseOAuthCallback: () =>
    `${BASE}/production-intelligence/integrations/loyverse/oauth/callback/`,
  loyversePOSWebhook: () =>
    `${BASE}/production-intelligence/webhooks/loyverse/`,
  cloverOAuthStart: () =>
    `${BASE}/production-intelligence/integrations/clover/oauth/start/`,
  cloverOAuthCallback: () =>
    `${BASE}/production-intelligence/integrations/clover/oauth/callback/`,
  cloverPOSWebhook: () => `${BASE}/production-intelligence/webhooks/clover/`,
} as const;
