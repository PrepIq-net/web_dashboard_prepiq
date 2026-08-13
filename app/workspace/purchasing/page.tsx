'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, WarningTriangle, CoinsSwap, Shop, Check, Package } from 'iconoir-react';
import { WorkspaceShell } from '@/components/dashboard/workspace-shell';
import { Select } from '@/components/ui/select';
import { useBranches, useCurrentUserProfile, useProductionIntelligenceAccessScope } from '@/services';
import { useTranslation } from "@/lib/i18n";
import { useSubscriptionTier } from '@/services/payment/hooks';
import { SubscriptionRequiredState } from '@/components/dashboard/empty-states/subscription-required-state';
import { resolvePermissions } from '@/lib/permissions';
import { PERMISSIONS } from '@/services/organizations/types';
import {
  usePurchaseRecommendation,
  useRecomputePurchaseRecommendation,
  useApprovePurchaseRecommendation,
  useUpdatePurchaseRecommendationLine,
  useReceiveDelivery,
  useSupplierSummary,
  useIngredientCostTrend,
  useCostVariance,
  usePurchasingEfficiency,
} from '@/services/inventory/hooks';
import type { PurchaseRecommendationLine } from '@/services/inventory/types';
import { formatMoney } from '@/lib/format';

type PurchasingTab = 'SUPPLIERS' | 'TRENDS' | 'VARIANCE' | 'EFFICIENCY' | 'FORECAST';

function toPercent(value: number) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const EMPTY_LIST: never[] = [];

function todayIso() { return new Date().toISOString().slice(0, 10); }

export default function PurchasingPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: user } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();
  const permissions = resolvePermissions(user);
  const canAccess = permissions.has(PERMISSIONS.MANAGE_INVENTORY);
  const isReadOnlyBranchManager = !permissions.has(PERMISSIONS.VIEW_FINANCIAL_DATA);
  const { isLoading: tierLoading, tier, planType } = useSubscriptionTier();

  const branchesQuery = useBranches(user?.organization_id ?? '');

  useEffect(() => {
    if (!tierLoading && !canAccess) router.replace('/');
  }, [tierLoading, canAccess, router]);

  const branches = branchesQuery.data ?? EMPTY_LIST;

  // Every number on this page — ingredient costs, supplier prices, purchase
  // recommendations — is branch-scoped in this domain (IngredientSupplier is
  // a per-branch table, so two branches can genuinely price the same
  // ingredient differently). There is no honest org-wide rollup of it, so
  // one branch selector drives the whole page rather than each tab
  // pretending to average across branches.
  const accessibleBranches = accessScope?.accessible_branches ?? EMPTY_LIST;
  const branchOptions = useMemo(() => {
    const ids = new Set(accessibleBranches.map((b) => b.id));
    const filtered = ids.size ? branches.filter((b) => ids.has(b.id)) : branches;
    return filtered.map((b) => ({ value: b.id, label: b.name }));
  }, [branches, accessibleBranches]);
  const defaultBranch =
    branches.find((b) => b.id === accessScope?.default_branch_id) ??
    branches.find((b) => b.is_primary) ??
    branches[0] ?? null;
  const [branchId, setBranchId] = useState('');

  useEffect(() => {
    if (!branchId && defaultBranch?.id) setBranchId(defaultBranch.id);
  }, [branchId, defaultBranch?.id]);

  const branchCurrency = branches.find((b) => b.id === branchId)?.currency ?? 'USD';
  const money = (value: number) => formatMoney(value, branchCurrency);

  const [activeTab, setActiveTab] = useState<PurchasingTab>('FORECAST');
  // Not useState(todayIso): new Date() computed during SSR and again during
  // client hydration can disagree (server/client clock or timezone drift),
  // which is a real hydration-mismatch trigger, not a hypothetical one — it
  // was caught live in this exact spot. Start empty (identical on server and
  // client) and fill in the real date once mounted; usePurchaseRecommendation
  // already treats an empty date as not-yet-ready.
  const [recommendationDate, setRecommendationDate] = useState('');
  useEffect(() => {
    setRecommendationDate(todayIso());
  }, []);

  const supplierQuery = useSupplierSummary(branchId, 90, Boolean(branchId));
  const trendQuery = useIngredientCostTrend(branchId, 90, Boolean(branchId));
  const varianceQuery = useCostVariance(branchId, 90, Boolean(branchId));
  const efficiencyQuery = usePurchasingEfficiency(branchId, 90, Boolean(branchId));

  const supplierRows = supplierQuery.data?.rows ?? EMPTY_LIST;
  const trendRows = trendQuery.data?.rows ?? EMPTY_LIST;
  const varianceRows = varianceQuery.data?.rows ?? EMPTY_LIST;

  const [supplierA, setSupplierA] = useState('');
  const [supplierB, setSupplierB] = useState('');
  const supplierSpend = (name: string) => supplierRows.find((r) => r.supplier === name)?.total_spend ?? 0;
  const supplierDelta = supplierA && supplierB && supplierA !== supplierB
    ? Math.abs(supplierSpend(supplierA) - supplierSpend(supplierB))
    : 0;

  const kpis = useMemo(() => {
    const deltas = trendRows.map((r) => r.cost_delta_pct).filter((v): v is number => v != null);
    return {
      totalSpend: supplierRows.reduce((s, r) => s + r.total_spend, 0),
      avgCostChange: deltas.length ? deltas.reduce((s, v) => s + v, 0) / deltas.length : 0,
      overpaymentCount: varianceRows.filter((r) => r.overpayment_flag).length,
      highVolatilityCount: trendRows.filter((r) => r.volatility === 'HIGH').length,
    };
  }, [supplierRows, varianceRows, trendRows]);

  const tabs: { id: PurchasingTab; label: string }[] = [
    { id: 'FORECAST', label: 'Purchase Plan' },
    { id: 'SUPPLIERS', label: t('workspace.purchasing.tabSuppliers') },
    { id: 'TRENDS', label: t('workspace.purchasing.tabItemTrends') },
    { id: 'VARIANCE', label: t('workspace.purchasing.tabVarianceDetection') },
    { id: 'EFFICIENCY', label: t('workspace.purchasing.tabOrderEfficiency') },
  ];

  const exportVariance = () => {
    downloadCsv('purchasing-variance.csv',
      [t('workspace.purchasing.exportColItem'), t('workspace.purchasing.exportColExpected'), t('workspace.purchasing.exportColActual'), t('workspace.purchasing.exportColOverpayment')],
      varianceRows.map((r) => [r.ingredient_name, r.expected_unit_cost.toFixed(2), r.actual_unit_cost.toFixed(2), r.overpayment_flag ? 'YES' : 'NO']));
  };

  if (!tierLoading && tier < 2) {
    return (
      <WorkspaceShell
        eyebrow={t('workspace.purchasing.eyebrow')}
        title={t('workspace.purchasing.title')}
        description={t('workspace.purchasing.description')}
        insight={t('workspace.purchasing.insight')}>
        <SubscriptionRequiredState variant='intelligence_required' currentPlanType={planType} compact />
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      eyebrow={t('workspace.purchasing.eyebrow')}
      title={t('workspace.purchasing.mainTitle')}
      description={t('workspace.purchasing.mainDescription')}
      insight={t('workspace.purchasing.insight')}>
      {isReadOnlyBranchManager ? (
        <div className='mb-6 flex items-start gap-2 rounded-xl border border-status-warning/20 bg-status-warning/8 p-4'>
          <WarningTriangle className='mt-0.5 h-4 w-4 text-status-warning' />
          <p className='text-sm text-text-secondary'>{t('workspace.purchasing.readOnlyBanner')}</p>
        </div>
      ) : null}

      <div className='mb-6 min-w-[220px] max-w-xs'>
        <p className='mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted'>Branch</p>
        <Select
          options={branchOptions}
          value={branchId}
          onChange={setBranchId}
          placeholder='Select branch'
          leadingIcon={<Shop className='h-4 w-4' />}
        />
      </div>

      <section className='grid grid-cols-1 gap-6 border-b border-surface-4/60 pb-8 md:grid-cols-4'>
        {[
          { label: t('workspace.purchasing.kpiTotalSpend'), value: money(kpis.totalSpend), cls: '' },
          { label: t('workspace.purchasing.kpiAvgCostChange'), value: toPercent(kpis.avgCostChange), cls: kpis.avgCostChange > 0 ? 'text-status-critical' : 'text-status-success' },
          { label: t('workspace.purchasing.kpiOverpaymentFlags'), value: String(kpis.overpaymentCount), cls: '' },
          { label: t('workspace.purchasing.kpiHighVolatilityItems'), value: String(kpis.highVolatilityCount), cls: '' },
        ].map((kpi) => (
          <article key={kpi.label} className='rounded-xl border border-surface-4 bg-surface-2 p-5'>
            <p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'>{kpi.label}</p>
            <p className={'mt-2 font-display text-[30px] text-text-primary' + (kpi.cls ? ' ' + kpi.cls : '')}>{kpi.value}</p>
          </article>
        ))}
      </section>

      <section className='mt-6'>
        <div className='flex gap-1 overflow-x-auto border-b-2 border-b-surface-4/60 scrollbar-thin'>
          {tabs.map((tab) => (
            <button key={tab.id} type='button' onClick={() => setActiveTab(tab.id)}
              className={'inline-flex h-10 shrink-0 items-center px-4 text-sm font-medium transition-all sm:text-base' + (
                activeTab === tab.id
                  ? ' -mb-[2px] border-b-2 border-brand-gold text-brand-gold'
                  : ' text-text-muted hover:text-text-secondary'
              )}>{tab.label}</button>
          ))}
        </div>
      </section>

      {activeTab === 'SUPPLIERS' && (
        <section className='mt-8'>
          <div className='mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center'>
            <div>
              <p className='text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold'>{t('workspace.purchasing.supplierSectionLabel')}</p>
              <h3 className='mt-1 font-display text-xl font-semibold text-text-primary'>{t('workspace.purchasing.supplierSectionTitle')}</h3>
              <p className='mt-1 text-sm text-text-secondary'>Real spend and delivery reliability from deliveries actually received, last 90 days.</p>
            </div>
          </div>
          {supplierQuery.isLoading ? (
            <TabLoading label='Loading supplier spend…' />
          ) : supplierRows.length === 0 ? (
            <TabEmpty title='No deliveries received yet' desc='Spend and reliability appear here once a delivery is logged for this branch, either from an approved purchase recommendation or an ad hoc receipt.' />
          ) : (
            <div className='overflow-x-auto rounded-xl border border-surface-4 bg-surface-2 scrollbar-thin'>
              <table className='w-full min-w-[680px]'>
                <thead className='border-b border-surface-4/80 bg-surface-3/40'>
                  <tr>{[t('workspace.purchasing.colSupplier'), t('workspace.purchasing.colTotalSpend'), 'Deliveries', 'Fulfillment'].map((h) => (
                    <th key={h} className='px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted'>{h}</th>
                  ))}</tr>
                </thead>
                <tbody className='divide-y divide-surface-4/50'>
                  {supplierRows.map((row) => (
                    <tr key={row.supplier} className='transition-colors hover:bg-surface-3/20'>
                      <td className='px-4 py-3 text-sm font-semibold text-text-primary'>{row.supplier}</td>
                      <td className='px-4 py-3 text-sm text-text-secondary'>{money(row.total_spend)}</td>
                      <td className='px-4 py-3 text-sm text-text-secondary'>{row.delivery_count}</td>
                      <td className='px-4 py-3 text-sm text-text-secondary'>
                        {row.fulfillment_pct != null ? `${row.fulfillment_pct.toFixed(0)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === 'TRENDS' && (
        <section className='mt-8'>
          <div className='mb-4'>
            <p className='text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold'>{t('workspace.purchasing.trendsSectionLabel')}</p>
            <h3 className='mt-1 font-display text-xl font-semibold text-text-primary'>{t('workspace.purchasing.trendsSectionTitle')}</h3>
            <p className='mt-1 text-sm text-text-secondary'>Unit cost movement between the earliest and most recent priced delivery, last 90 days.</p>
          </div>
          {trendQuery.isLoading ? (
            <TabLoading label='Loading cost trends…' />
          ) : trendRows.length === 0 ? (
            <TabEmpty title='No priced deliveries yet' desc='Cost trends appear once at least one delivery with a known cost has been received for an ingredient at this branch.' />
          ) : (
            <div className='overflow-x-auto rounded-xl border border-surface-4 bg-surface-2 scrollbar-thin'>
              <table className='w-full min-w-[780px]'>
                <thead className='border-b border-surface-4/80 bg-surface-3/40'>
                  <tr>{[t('workspace.purchasing.colItem'), t('workspace.purchasing.colUnitCost'), t('workspace.purchasing.colVariance'), t('workspace.purchasing.colVolatility'), t('workspace.purchasing.colAlert')].map((h) => (
                    <th key={h} className='px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted'>{h}</th>
                  ))}</tr>
                </thead>
                <tbody className='divide-y divide-surface-4/50'>
                  {trendRows.map((row) => {
                    const badge = row.volatility === 'HIGH'
                      ? 'bg-status-critical/10 text-status-critical border-status-critical/30'
                      : row.volatility === 'MEDIUM'
                        ? 'bg-status-warning/10 text-status-warning border-status-warning/30'
                        : 'bg-status-success/10 text-status-success border-status-success/30';
                    const alertText = row.volatility === 'HIGH'
                      ? t('workspace.purchasing.alertCriticalSpike')
                      : row.volatility === 'MEDIUM'
                        ? t('workspace.purchasing.alertMonitorClosely')
                        : t('workspace.purchasing.alertStable');
                    return (
                      <tr key={row.ingredient_id} className='transition-colors hover:bg-surface-3/20'>
                        <td className='px-4 py-3 text-sm font-semibold text-text-primary'>{row.ingredient_name}</td>
                        <td className='px-4 py-3 text-sm text-text-secondary'>
                          {money(row.current_unit_cost)} <span className='text-[11px] uppercase text-text-muted'>/{row.unit}</span>
                        </td>
                        <td className={'px-4 py-3 text-sm ' + (row.cost_delta_pct != null && row.cost_delta_pct >= 0 ? 'text-status-critical' : 'text-status-success')}>
                          {row.cost_delta_pct != null ? toPercent(row.cost_delta_pct) : '—'}
                        </td>
                        <td className='px-4 py-3 text-sm'>
                          <span className={'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ' + badge}>{row.volatility}</span>
                        </td>
                        <td className='px-4 py-3 text-sm text-text-secondary'>{alertText}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === 'VARIANCE' && (
        <section className='mt-8'>
          <div className='mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center'>
            <div>
              <p className='text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold'>{t('workspace.purchasing.varianceSectionLabel')}</p>
              <h3 className='mt-1 font-display text-xl font-semibold text-text-primary'>Cost Variance</h3>
              <p className='mt-1 text-sm text-text-secondary'>What&apos;s configured per supplier vs. what was actually paid at the last delivery.</p>
            </div>
            {varianceRows.length > 0 && (
              <button type='button' onClick={exportVariance} disabled={isReadOnlyBranchManager}
                className='inline-flex h-8 items-center gap-1 rounded-lg border border-surface-4 px-2.5 text-sm text-text-primary transition-colors hover:border-brand-gold/40 hover:text-brand-gold disabled:opacity-50'>
                <Download className='h-3.5 w-3.5' /> {t('workspace.purchasing.exportButton')}
              </button>
            )}
          </div>
          {varianceQuery.isLoading ? (
            <TabLoading label='Loading cost variance…' />
          ) : varianceRows.length === 0 ? (
            <TabEmpty title='Nothing to compare yet' desc='This needs both a configured supplier cost and at least one priced delivery for the same ingredient.' />
          ) : (
            <div className='overflow-x-auto rounded-xl border border-surface-4 bg-surface-2 scrollbar-thin'>
              <table className='w-full min-w-[680px]'>
                <thead className='border-b border-surface-4/80 bg-surface-3/40'>
                  <tr>{[t('workspace.purchasing.colItem'), t('workspace.purchasing.colExpected'), t('workspace.purchasing.colActual'), t('workspace.purchasing.colFlags')].map((h) => (
                    <th key={h} className='px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted'>{h}</th>
                  ))}</tr>
                </thead>
                <tbody className='divide-y divide-surface-4/50'>
                  {varianceRows.map((row) => (
                    <tr key={row.ingredient_id} className='transition-colors hover:bg-surface-3/20'>
                      <td className='px-4 py-3 text-sm font-semibold text-text-primary'>{row.ingredient_name}</td>
                      <td className='px-4 py-3 text-sm text-text-secondary'>{money(row.expected_unit_cost)}</td>
                      <td className='px-4 py-3 text-sm text-text-secondary'>{money(row.actual_unit_cost)}</td>
                      <td className='px-4 py-3 text-sm'>
                        {row.overpayment_flag && (
                          <span className='inline-flex items-center rounded-full border border-status-critical/30 bg-status-critical/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-status-critical'>{t('workspace.purchasing.flagOverpayment')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === 'EFFICIENCY' && (
        <section className='mt-8'>
          <div className='grid grid-cols-1 gap-8 lg:grid-cols-3'>
            <article className='lg:col-span-2'>
              <div className='mb-4'>
                <p className='text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold'>{t('workspace.purchasing.efficiencySectionLabel')}</p>
                <h3 className='mt-1 font-display text-xl font-semibold text-text-primary'>Purchasing Efficiency</h3>
                <p className='mt-1 text-sm text-text-secondary'>Last 90 days at this branch.</p>
              </div>
              {efficiencyQuery.isLoading ? (
                <TabLoading label='Loading efficiency…' />
              ) : !efficiencyQuery.data || efficiencyQuery.data.total_received_events === 0 ? (
                <TabEmpty title='No deliveries in this window' desc='Efficiency signals build up as deliveries are received and stock is consumed or wasted.' />
              ) : (
                <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
                  <article className='rounded-xl border border-surface-4 bg-surface-2 p-5'>
                    <p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'>Sitting Unused</p>
                    <p className={'mt-2 font-display text-[26px] ' + (efficiencyQuery.data.over_ordering_pct > 20 ? 'text-status-warning' : 'text-text-primary')}>
                      {efficiencyQuery.data.over_ordering_pct.toFixed(0)}%
                    </p>
                    <p className='mt-1 text-xs text-text-muted'>of what was received hasn&apos;t been consumed or wasted yet</p>
                  </article>
                  <article className='rounded-xl border border-surface-4 bg-surface-2 p-5'>
                    <p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'>Emergency Purchases</p>
                    <p className='mt-2 font-display text-[26px] text-text-primary'>{efficiencyQuery.data.emergency_purchase_count}</p>
                    <p className='mt-1 text-xs text-text-muted'>deliveries received with no purchase recommendation behind them</p>
                  </article>
                  <article className='rounded-xl border border-surface-4 bg-surface-2 p-5'>
                    <p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'>Stockout-Driven</p>
                    <p className='mt-2 font-display text-[26px] text-text-primary'>{efficiencyQuery.data.stockout_caused_purchase_count}</p>
                    <p className='mt-1 text-xs text-text-muted'>purchase lines triggered by running low, not by tomorrow&apos;s forecast</p>
                  </article>
                </div>
              )}
            </article>

            <article className='rounded-xl border border-surface-4 bg-surface-2 p-5'>
              <div className='mb-4'>
                <p className='text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold'>{t('workspace.purchasing.compareSectionLabel')}</p>
                <h3 className='mt-1 font-display text-xl font-semibold text-text-primary'>{t('workspace.purchasing.compareSectionTitle')}</h3>
                <p className='mt-1 text-sm text-text-secondary'>{t('workspace.purchasing.compareSectionDesc')}</p>
              </div>
              <div className='space-y-3'>
                <Select options={[{ value: '', label: t('workspace.purchasing.supplierALabel') }, ...supplierRows.map((r) => ({ value: r.supplier, label: r.supplier }))]}
                  value={supplierA} onChange={(v) => setSupplierA(v)} placeholder={t('workspace.purchasing.selectSupplierAPlaceholder')} />
                <Select options={[{ value: '', label: t('workspace.purchasing.supplierBLabel') }, ...supplierRows.map((r) => ({ value: r.supplier, label: r.supplier }))]}
                  value={supplierB} onChange={(v) => setSupplierB(v)} placeholder={t('workspace.purchasing.selectSupplierBPlaceholder')} />
              </div>
              <div className='mt-6'>
                <p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'>{t('workspace.purchasing.spendDeltaLabel')}</p>
                <p className='mt-1 font-display text-[26px] text-text-primary'>{money(supplierDelta)}</p>
              </div>
              <div className='mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-surface-4 px-4 text-sm text-text-muted'>
                <CoinsSwap className='h-4 w-4' /> Last 90 days
              </div>
            </article>
          </div>
        </section>
      )}

      {activeTab === 'FORECAST' && (
        <ForecastTab
          branchId={branchId}
          date={recommendationDate}
          onDateChange={setRecommendationDate}
          money={money}
          isReadOnlyBranchManager={isReadOnlyBranchManager}
        />
      )}
    </WorkspaceShell>
  );
}

function TabLoading({ label }: { label: string }) {
  return (
    <div className='flex items-center justify-center rounded-xl border border-surface-4 bg-surface-2 py-16'>
      <div className='h-5 w-5 animate-spin rounded-full border-2 border-brand-gold border-t-transparent' />
      <span className='ml-3 text-sm text-text-muted'>{label}</span>
    </div>
  );
}

function TabEmpty({ title, desc }: { title: string; desc: string }) {
  return (
    <div className='rounded-xl border border-surface-4 bg-surface-2 py-16 text-center'>
      <p className='text-sm font-semibold text-text-secondary'>{title}</p>
      <p className='mx-auto mt-1 max-w-sm text-xs text-text-muted'>{desc}</p>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
  ORDERED: 'Ordered',
  PARTIALLY_RECEIVED: 'Partially received',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
};

function ForecastTab({
  branchId,
  date,
  onDateChange,
  money,
  isReadOnlyBranchManager,
}: {
  branchId: string;
  date: string;
  onDateChange: (v: string) => void;
  money: (v: number) => string;
  isReadOnlyBranchManager: boolean;
}) {
  const recQuery = usePurchaseRecommendation(branchId, date, Boolean(branchId));
  const recompute = useRecomputePurchaseRecommendation(branchId);
  const approve = useApprovePurchaseRecommendation(branchId);
  const updateLine = useUpdatePurchaseRecommendationLine(branchId, date);
  const receive = useReceiveDelivery(branchId, date);

  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [receivingLineId, setReceivingLineId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState('');
  const [receiveCost, setReceiveCost] = useState('');

  const notComputed = recQuery.isError;
  const recommendation = recQuery.data;
  const lines = recommendation?.lines ?? EMPTY_LIST;

  const startEdit = (line: PurchaseRecommendationLine) => {
    setEditingLineId(line.id);
    setEditValue(String(line.manager_override_qty ?? line.recommended_purchase_qty));
  };
  const saveEdit = (line: PurchaseRecommendationLine) => {
    const parsed = Number(editValue);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    updateLine.mutate({ lineId: line.id, managerOverrideQty: parsed });
    setEditingLineId(null);
  };

  const startReceive = (line: PurchaseRecommendationLine) => {
    setReceivingLineId(line.id);
    setReceiveQty(String(line.quantity_to_order - line.received_quantity));
    setReceiveCost(line.cost_per_pack && line.pack_size ? String(line.cost_per_pack / line.pack_size) : '');
  };
  const confirmReceive = (line: PurchaseRecommendationLine) => {
    const qty = Number(receiveQty);
    if (!Number.isFinite(qty) || qty <= 0) return;
    receive.mutate({
      recommendation_line_id: line.id,
      quantity: qty,
      unit_cost: receiveCost ? Number(receiveCost) : undefined,
    }, { onSuccess: () => setReceivingLineId(null) });
  };

  const exportLines = () => {
    downloadCsv('purchase-plan.csv',
      ['Ingredient', 'Unit', 'On Hand', 'Net Need', 'Trigger', 'To Order', 'Est. Cost', 'Supplier'],
      lines.map((r) => [
        r.ingredient_name, r.unit, r.on_hand_qty.toFixed(2), r.net_need.toFixed(2), r.trigger,
        r.quantity_to_order.toFixed(2), r.estimated_cost != null ? r.estimated_cost.toFixed(2) : '—', r.supplier_name || '—',
      ]));
  };

  return (
    <section className='mt-8'>
      <div className='mb-6 flex flex-wrap items-end justify-between gap-4'>
        <div>
          <p className='mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted'>Date</p>
          <input
            type='date'
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className='h-10 rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary focus:border-brand-gold/60 focus:outline-none focus:ring-1 focus:ring-brand-gold/30'
          />
        </div>
        {!isReadOnlyBranchManager && branchId ? (
          <button
            type='button'
            onClick={() => recompute.mutate(date)}
            disabled={recompute.isPending}
            className='inline-flex h-10 items-center gap-2 rounded-full bg-brand-gold px-4 text-sm font-semibold text-surface-1 transition-opacity hover:opacity-90 disabled:opacity-60'
          >
            {recompute.isPending ? 'Recalculating…' : notComputed ? 'Generate purchase plan' : 'Recalculate'}
          </button>
        ) : null}
      </div>

      <div className='mb-4 flex items-center justify-between'>
        <div>
          <p className='text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold'>Purchase Plan</p>
          <h3 className='mt-1 font-display text-xl font-semibold text-text-primary'>What to order</h3>
          <p className='mt-1 text-sm text-text-secondary'>
            Combines tomorrow&apos;s forecast demand with what&apos;s currently running low, netted against on-hand stock.
          </p>
        </div>
        <div className='flex items-center gap-2'>
          {recommendation ? (
            <span className='inline-flex items-center rounded-full border border-surface-4 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary'>
              {STATUS_LABEL[recommendation.status] ?? recommendation.status}
            </span>
          ) : null}
          {recommendation && recommendation.status === 'DRAFT' && lines.length > 0 && !isReadOnlyBranchManager ? (
            <button type='button' onClick={() => approve.mutate(recommendation.id)} disabled={approve.isPending}
              className='inline-flex h-8 items-center gap-1.5 rounded-full border border-brand-gold/50 px-3 text-xs font-semibold text-brand-gold transition-colors hover:bg-brand-gold/10 disabled:opacity-60'>
              <Check className='h-3.5 w-3.5' /> {approve.isPending ? 'Approving…' : 'Approve'}
            </button>
          ) : null}
          {lines.length > 0 ? (
            <button type='button' onClick={exportLines} disabled={isReadOnlyBranchManager}
              className='inline-flex h-8 items-center gap-1 rounded-lg border border-surface-4 px-2.5 text-sm text-text-primary transition-colors hover:border-brand-gold/40 hover:text-brand-gold disabled:opacity-50'>
              <Download className='h-3.5 w-3.5' /> Export
            </button>
          ) : null}
        </div>
      </div>

      {recommendation?.total_estimated_cost != null && (
        <div className='mb-6 inline-flex items-baseline gap-3 rounded-xl border border-surface-4 bg-surface-2 px-5 py-3'>
          <p className='text-xs font-semibold uppercase tracking-[0.12em] text-text-muted'>Total Estimated Cost</p>
          <p className='font-display text-2xl font-semibold text-brand-gold'>{money(recommendation.total_estimated_cost)}</p>
        </div>
      )}

      <div className='overflow-x-auto rounded-xl border border-surface-4 bg-surface-2 scrollbar-thin'>
        {recQuery.isLoading ? (
          <TabLoading label='Loading purchase plan…' />
        ) : notComputed ? (
          <div className='py-16 text-center'>
            <p className='text-sm font-semibold text-text-secondary'>No purchase plan for this date yet</p>
            <p className='mx-auto mt-1 max-w-sm text-xs text-text-muted'>
              A plan is generated automatically when the day&apos;s prep plan is locked, or you can generate one now.
            </p>
          </div>
        ) : !lines.length ? (
          <div className='py-16 text-center'>
            <p className='text-sm font-semibold text-text-secondary'>Nothing to order</p>
            <p className='mx-auto mt-1 max-w-sm text-xs text-text-muted'>
              Current stock covers tomorrow&apos;s forecast and nothing is running low.
            </p>
          </div>
        ) : (
          <table className='w-full min-w-[960px]'>
            <thead className='border-b border-surface-4/80 bg-surface-3/40'>
              <tr>
                {['Ingredient', 'On Hand', 'Net Need', 'Why', 'To Order', 'Est. Cost', 'Supplier', 'Received', ''].map((h) => (
                  <th key={h} className='px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted'>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className='divide-y divide-surface-4/50'>
              {lines.map((row) => {
                const isEditing = editingLineId === row.id;
                const isReceiving = receivingLineId === row.id;
                const outstanding = Math.max(0, row.quantity_to_order - row.received_quantity);
                return (
                  <Fragment key={row.id}>
                    <tr className='transition-colors hover:bg-surface-3/20'>
                      <td className='px-4 py-3 text-sm font-semibold text-text-primary'>{row.ingredient_name}</td>
                      <td className='px-4 py-3 text-sm text-text-secondary'>{row.on_hand_qty.toFixed(2)} <span className='text-[11px] uppercase text-text-muted'>{row.unit}</span></td>
                      <td className='px-4 py-3 text-sm font-semibold text-status-warning'>{row.net_need.toFixed(2)} <span className='text-[11px] font-normal uppercase text-text-muted'>{row.unit}</span></td>
                      <td className='px-4 py-3 text-sm text-text-secondary'>
                        {row.trigger === 'BOTH' ? 'Forecast + low stock' : row.trigger === 'RUN_RATE_LOW_STOCK' ? 'Running low' : "Tomorrow's forecast"}
                      </td>
                      <td className='px-4 py-3 text-sm font-semibold text-brand-gold'>
                        {isEditing ? (
                          <div className='flex items-center gap-1.5'>
                            <input
                              type='number' min={0} step='0.01' value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className='h-7 w-20 rounded-lg border border-surface-4 bg-surface-3 px-2 text-sm text-text-primary focus:border-brand-gold/60 focus:outline-none'
                              autoFocus
                            />
                            <button type='button' onClick={() => saveEdit(row)} className='text-status-success'><Check className='h-4 w-4' /></button>
                          </div>
                        ) : (
                          <button type='button' disabled={isReadOnlyBranchManager} onClick={() => startEdit(row)} className='disabled:cursor-default'>
                            {row.quantity_to_order.toFixed(2)} <span className='text-[11px] font-normal uppercase text-text-muted'>{row.unit}</span>
                            {row.manager_override_qty != null ? <span className='ml-1 text-[10px] font-normal text-text-muted'>(edited)</span> : null}
                          </button>
                        )}
                      </td>
                      <td className='px-4 py-3 text-sm text-text-secondary'>{row.estimated_cost != null ? money(row.estimated_cost) : '—'}</td>
                      <td className='px-4 py-3 text-sm text-text-secondary'>{row.supplier_name || '—'}</td>
                      <td className='px-4 py-3 text-sm text-text-secondary'>
                        {row.received_quantity > 0 ? `${row.received_quantity.toFixed(2)} ${row.unit}` : '—'}
                      </td>
                      <td className='px-4 py-3 text-sm'>
                        {!isReadOnlyBranchManager && outstanding > 0 ? (
                          <button type='button' onClick={() => (isReceiving ? setReceivingLineId(null) : startReceive(row))}
                            className='inline-flex h-7 items-center gap-1.5 rounded-full border border-surface-4 px-3 text-xs text-text-secondary transition-colors hover:border-brand-gold/40 hover:text-brand-gold'>
                            <Package className='h-3.5 w-3.5' /> Receive
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    {isReceiving && (
                      <tr className='bg-surface-3/30'>
                        <td colSpan={9} className='px-4 py-3'>
                          <div className='flex flex-wrap items-end gap-3'>
                            <div>
                              <p className='mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted'>Quantity ({row.unit})</p>
                              <input type='number' min={0} step='0.01' value={receiveQty} onChange={(e) => setReceiveQty(e.target.value)}
                                className='h-8 w-28 rounded-lg border border-surface-4 bg-surface-2 px-2 text-sm text-text-primary focus:border-brand-gold/60 focus:outline-none' />
                            </div>
                            <div>
                              <p className='mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted'>Unit cost (optional)</p>
                              <input type='number' min={0} step='0.01' value={receiveCost} onChange={(e) => setReceiveCost(e.target.value)}
                                className='h-8 w-28 rounded-lg border border-surface-4 bg-surface-2 px-2 text-sm text-text-primary focus:border-brand-gold/60 focus:outline-none' />
                            </div>
                            <button type='button' onClick={() => confirmReceive(row)} disabled={receive.isPending}
                              className='inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-gold px-3 text-xs font-semibold text-surface-1 transition-opacity hover:opacity-90 disabled:opacity-60'>
                              {receive.isPending ? 'Recording…' : 'Confirm delivery'}
                            </button>
                            <button type='button' onClick={() => setReceivingLineId(null)} className='text-xs text-text-muted hover:text-text-secondary'>Cancel</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
