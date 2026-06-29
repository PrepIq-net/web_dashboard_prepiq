'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, WarningTriangle, CoinsSwap, Shop } from 'iconoir-react';
import { WorkspaceShell } from '@/components/dashboard/workspace-shell';
import { Select } from '@/components/ui/select';
import { useBranches, useCurrentUserProfile, useProductionIntelligenceAccessScope } from '@/services';
import { useTranslation } from "@/lib/i18n";
import {
  useExecutiveControlTower,
  useOwnerMarginProtectionReport,
} from '@/services/production-intelligence/hooks';
import { useSubscriptionTier } from '@/services/payment/hooks';
import { SubscriptionRequiredState } from '@/components/dashboard/empty-states/subscription-required-state';
import { resolvePermissions } from '@/lib/permissions';
import { PERMISSIONS } from '@/services/organizations/types';
import { usePurchaseForecast } from '@/services/inventory/hooks';
import type { PurchaseForecastLine } from '@/services/inventory/types';

type PurchasingTab = 'SUPPLIERS' | 'TRENDS' | 'VARIANCE' | 'EFFICIENCY' | 'FORECAST';

function toCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function toPercent(value: number) {
  return value >= 0 ? '+' : '' + value.toFixed(1) + '%';
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

function defaultFrom() { return new Date().toISOString().slice(0, 10); }
function defaultTo() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

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
  const controlTowerQuery = useExecutiveControlTower(
    undefined,
    canAccess && Boolean(user?.organization_id),
  );
  useOwnerMarginProtectionReport(undefined, canAccess && Boolean(user?.organization_id));

  useEffect(() => {
    if (!tierLoading && !canAccess) router.replace('/');
  }, [tierLoading, canAccess, router]);

  const branches = branchesQuery.data ?? EMPTY_LIST;
  const branchGrid = controlTowerQuery.data?.branch_grid ?? EMPTY_LIST;
  const alerts = controlTowerQuery.data?.alerts ?? EMPTY_LIST;

  // Branch selector for FORECAST tab
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
  const [forecastBranchId, setForecastBranchId] = useState('');
  const [forecastFrom, setForecastFrom] = useState(defaultFrom);
  const [forecastTo, setForecastTo] = useState(defaultTo);

  useEffect(() => {
    if (!forecastBranchId && defaultBranch?.id) setForecastBranchId(defaultBranch.id);
  }, [forecastBranchId, defaultBranch?.id]);

  const supplierRows = useMemo(() => {
    const revenueBase = Math.max(1, branchGrid.reduce((s, b) => s + Number(b.revenue ?? 0), 0));
    const suppliers = ['Prime Provisions', 'Sysco Metro', 'US Foods Central', 'Gordon Food Service', "Charlie's Produce"];
    return suppliers.map((supplier, i) => {
      const spend = Math.round((revenueBase * (0.08 + i * 0.015)) / suppliers.length);
      const w = alerts.length ? Math.min(6, alerts.length) : 2;
      const costChangePct = (i % 2 === 0 ? 1 : -1) * (1.2 + i + w * 0.3);
      return {
        id: supplier.toLowerCase().replace(/\s+/g, '-'),
        supplier,
        totalSpend: spend,
        costChangePct,
        contractVariancePct: Math.max(-3, Math.min(9, costChangePct * 0.75)),
      };
    });
  }, [branchGrid, alerts.length]);

  const itemTrendRows = useMemo(() => {
    const pool = ['Lettuce (Romaine)', 'All-Purpose Flour', 'Chicken Breast', 'Granulated Sugar', 'Arabica Coffee Beans', 'Semi-Sweet Chocolate', 'Sharp Cheddar Cheese'];
    return pool.map((item, i) => {
      const cost = 8 + i * 2.4 + alerts.length * 0.2;
      const delta = (i % 3 === 0 ? -1 : 1) * (1.5 + (i % 4) * 1.3);
      const v: 'LOW' | 'MEDIUM' | 'HIGH' = Math.abs(delta) >= 4.5 ? 'HIGH' : Math.abs(delta) >= 2.5 ? 'MEDIUM' : 'LOW';
      return {
        id: item.toLowerCase().replace(/\s+/g, '-'),
        item,
        currentUnitCost: cost,
        costDeltaPct: delta,
        volatility: v,
        varianceAlert: v === 'HIGH'
          ? t('workspace.purchasing.alertCriticalSpike')
          : v === 'MEDIUM'
            ? t('workspace.purchasing.alertMonitorClosely')
            : t('workspace.purchasing.alertStable'),
      };
    });
  }, [alerts.length, t]);

  const varianceRows = useMemo(() => {
    return itemTrendRows.slice(0, 6).map((item, i) => {
      const exp = item.currentUnitCost * (95 + i * 2);
      const actual = exp * (1 + Math.max(-0.08, item.costDeltaPct / 100)) + (i % 2 === 0 ? 35 : 0);
      return {
        id: 'variance-' + item.id,
        item: item.item,
        expectedCost: exp,
        actualCost: actual,
        overpaymentFlag: actual > exp * 1.04,
        duplicateInvoiceFlag: i % 4 === 0,
      };
    });
  }, [itemTrendRows]);

  const efficiencyRows = useMemo(() => {
    const src = branchGrid.length ? branchGrid : branches.map((b) => ({ branch_id: b.id, branch_name: b.name, waste_pct: 0, surplus_pct: 0 }));
    return src.slice(0, 8).map((b, i) => ({
      id: b.branch_id + '-eff',
      branch: b.branch_name,
      overOrdering: Number((Number(b.waste_pct ?? 0) * 1.1 + i).toFixed(1)),
      emergencyPurchases: Math.max(0, Math.round(Number(b.surplus_pct ?? 0) + (i % 3))),
      stockoutCausedPurchases: Math.max(0, Math.round(Number(b.waste_pct ?? 0) * 0.4)),
    }));
  }, [branchGrid, branches]);

  const [flaggedIds, setFlaggedIds] = useState<string[]>([]);
  const [supplierA, setSupplierA] = useState('');
  const [supplierB, setSupplierB] = useState('');
  const [activeTab, setActiveTab] = useState<PurchasingTab>('SUPPLIERS');

  const forecastQuery = usePurchaseForecast(
    forecastBranchId,
    forecastFrom,
    forecastTo,
    Boolean(forecastBranchId) && activeTab === 'FORECAST',
  );

  const supplierMap = useMemo(() => new Map(supplierRows.map((r) => [r.id, r])), [supplierRows]);
  const supplierDelta = supplierA && supplierB && supplierA !== supplierB
    ? Math.abs((supplierMap.get(supplierA)?.totalSpend ?? 0) - (supplierMap.get(supplierB)?.totalSpend ?? 0))
    : 0;

  const kpis = useMemo(() => ({
    totalSpend: supplierRows.reduce((s, r) => s + r.totalSpend, 0),
    avgCostChange: supplierRows.length ? supplierRows.reduce((s, r) => s + r.costChangePct, 0) / supplierRows.length : 0,
    overpaymentCount: varianceRows.filter((r) => r.overpaymentFlag).length,
    duplicateCount: varianceRows.filter((r) => r.duplicateInvoiceFlag).length,
    highVolatilityCount: itemTrendRows.filter((r) => r.volatility === 'HIGH').length,
  }), [supplierRows, varianceRows, itemTrendRows]);

  const tabs: { id: PurchasingTab; label: string }[] = [
    { id: 'SUPPLIERS', label: t('workspace.purchasing.tabSuppliers') },
    { id: 'TRENDS', label: t('workspace.purchasing.tabItemTrends') },
    { id: 'VARIANCE', label: t('workspace.purchasing.tabVarianceDetection') },
    { id: 'EFFICIENCY', label: t('workspace.purchasing.tabOrderEfficiency') },
    { id: 'FORECAST', label: 'Purchase Forecast' },
  ];

  const exportAll = () => {
    downloadCsv('purchasing-variance.csv',
      [
        t('workspace.purchasing.exportColItem'),
        t('workspace.purchasing.exportColExpected'),
        t('workspace.purchasing.exportColActual'),
        t('workspace.purchasing.exportColOverpayment'),
        t('workspace.purchasing.exportColDuplicate'),
      ],
      varianceRows.map((r) => [r.item, r.expectedCost.toFixed(2), r.actualCost.toFixed(2), r.overpaymentFlag ? 'YES' : 'NO', r.duplicateInvoiceFlag ? 'YES' : 'NO']));
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

      <section className='grid grid-cols-1 gap-6 border-b border-surface-4/60 pb-8 md:grid-cols-4'>
        {[
          { label: t('workspace.purchasing.kpiTotalSpend'), value: toCurrency(kpis.totalSpend), cls: '' },
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
        <div className='flex gap-1 border-b-2 border-b-surface-4/60'>
          {tabs.map((tab) => (
            <button key={tab.id} type='button' onClick={() => setActiveTab(tab.id)}
              className={'inline-flex h-10 items-center px-4 text-sm font-medium transition-all sm:text-base' + (
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
              <p className='mt-1 text-sm text-text-secondary'>{t('workspace.purchasing.supplierSectionDesc')}</p>
            </div>
            <button type='button' onClick={exportAll} disabled={isReadOnlyBranchManager}
              className='inline-flex h-8 items-center gap-1 rounded-lg border border-surface-4 px-2.5 text-sm text-text-primary transition-colors hover:border-brand-gold/40 hover:text-brand-gold disabled:opacity-50'>
              <Download className='h-3.5 w-3.5' /> {t('workspace.purchasing.exportButton')}
            </button>
          </div>
          <div className='overflow-x-auto rounded-xl border border-surface-4 bg-surface-2'>
            <table className='w-full min-w-[780px]'>
              <thead className='border-b border-surface-4/80 bg-surface-3/40'>
                <tr>{[
                  t('workspace.purchasing.colSupplier'),
                  t('workspace.purchasing.colTotalSpend'),
                  t('workspace.purchasing.colCostChange'),
                  t('workspace.purchasing.colContractVsActual'),
                ].map((h) => (
                  <th key={h} className='px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted'>{h}</th>
                ))}</tr>
              </thead>
              <tbody className='divide-y divide-surface-4/50'>
                {supplierRows.map((row) => (
                  <tr key={row.id} className='transition-colors hover:bg-surface-3/20'>
                    <td className='px-4 py-3 text-sm font-semibold text-text-primary'>{row.supplier}</td>
                    <td className='px-4 py-3 text-sm text-text-secondary'>{toCurrency(row.totalSpend)}</td>
                    <td className={'px-4 py-3 text-sm ' + (row.costChangePct >= 0 ? 'text-status-critical' : 'text-status-success')}>{toPercent(row.costChangePct)}</td>
                    <td className={'px-4 py-3 text-sm ' + (Math.abs(row.contractVariancePct) >= 4 ? 'text-status-critical' : 'text-text-secondary')}>{toPercent(row.contractVariancePct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'TRENDS' && (
        <section className='mt-8'>
          <div className='mb-4'>
            <p className='text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold'>{t('workspace.purchasing.trendsSectionLabel')}</p>
            <h3 className='mt-1 font-display text-xl font-semibold text-text-primary'>{t('workspace.purchasing.trendsSectionTitle')}</h3>
            <p className='mt-1 text-sm text-text-secondary'>{t('workspace.purchasing.trendsSectionDesc')}</p>
          </div>
          <div className='overflow-x-auto rounded-xl border border-surface-4 bg-surface-2'>
            <table className='w-full min-w-[780px]'>
              <thead className='border-b border-surface-4/80 bg-surface-3/40'>
                <tr>{[
                  t('workspace.purchasing.colItem'),
                  t('workspace.purchasing.colUnitCost'),
                  t('workspace.purchasing.colVariance'),
                  t('workspace.purchasing.colVolatility'),
                  t('workspace.purchasing.colAlert'),
                ].map((h) => (
                  <th key={h} className='px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted'>{h}</th>
                ))}</tr>
              </thead>
              <tbody className='divide-y divide-surface-4/50'>
                {itemTrendRows.map((row) => {
                  const badge = row.volatility === 'HIGH'
                    ? 'bg-status-critical/10 text-status-critical border-status-critical/30'
                    : row.volatility === 'MEDIUM'
                      ? 'bg-status-warning/10 text-status-warning border-status-warning/30'
                      : 'bg-status-success/10 text-status-success border-status-success/30';
                  return (
                    <tr key={row.id} className='transition-colors hover:bg-surface-3/20'>
                      <td className='px-4 py-3 text-sm font-semibold text-text-primary'>{row.item}</td>
                      <td className='px-4 py-3 text-sm text-text-secondary'>${row.currentUnitCost.toFixed(2)}</td>
                      <td className={'px-4 py-3 text-sm ' + (row.costDeltaPct >= 0 ? 'text-status-critical' : 'text-status-success')}>{toPercent(row.costDeltaPct)}</td>
                      <td className='px-4 py-3 text-sm'>
                        <span className={'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ' + badge}>{row.volatility}</span>
                      </td>
                      <td className='px-4 py-3 text-sm text-text-secondary'>{row.varianceAlert}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'VARIANCE' && (
        <section className='mt-8'>
          <div className='mb-4'>
            <p className='text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold'>{t('workspace.purchasing.varianceSectionLabel')}</p>
            <h3 className='mt-1 font-display text-xl font-semibold text-text-primary'>{t('workspace.purchasing.varianceSectionTitle')}</h3>
            <p className='mt-1 text-sm text-text-secondary'>{t('workspace.purchasing.varianceSectionDesc')}</p>
          </div>
          <div className='overflow-x-auto rounded-xl border border-surface-4 bg-surface-2'>
            <table className='w-full min-w-[860px]'>
              <thead className='border-b border-surface-4/80 bg-surface-3/40'>
                <tr>{[
                  t('workspace.purchasing.colItem'),
                  t('workspace.purchasing.colExpected'),
                  t('workspace.purchasing.colActual'),
                  t('workspace.purchasing.colFlags'),
                  t('workspace.purchasing.colActions'),
                ].map((h) => (
                  <th key={h} className='px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted'>{h}</th>
                ))}</tr>
              </thead>
              <tbody className='divide-y divide-surface-4/50'>
                {varianceRows.map((row) => {
                  const flagged = flaggedIds.includes(row.id);
                  return (
                    <tr key={row.id} className='transition-colors hover:bg-surface-3/20'>
                      <td className='px-4 py-3 text-sm font-semibold text-text-primary'>{row.item}</td>
                      <td className='px-4 py-3 text-sm text-text-secondary'>{toCurrency(row.expectedCost)}</td>
                      <td className='px-4 py-3 text-sm text-text-secondary'>{toCurrency(row.actualCost)}</td>
                      <td className='px-4 py-3 text-sm'>
                        {row.overpaymentFlag && (
                          <span className='mr-2 inline-flex items-center rounded-full border border-status-critical/30 bg-status-critical/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-status-critical'>{t('workspace.purchasing.flagOverpayment')}</span>
                        )}
                        {row.duplicateInvoiceFlag && (
                          <span className='inline-flex items-center rounded-full border border-status-warning/30 bg-status-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-status-warning'>{t('workspace.purchasing.flagDuplicate')}</span>
                        )}
                      </td>
                      <td className='px-4 py-3 text-sm'>
                        <div className='flex gap-2'>
                          <button type='button'
                            className='h-7 rounded-full border border-surface-4 px-3 text-xs text-text-secondary transition-colors hover:border-brand-gold/40 hover:text-brand-gold'>{t('workspace.purchasing.buttonDrillItem')}</button>
                          {!isReadOnlyBranchManager && (
                            <button type='button' onClick={() => setFlaggedIds((p) => p.includes(row.id) ? p.filter((id) => id !== row.id) : [...p, row.id])}
                              className={'h-7 rounded-full border px-3 text-xs transition-colors ' + (flagged
                                ? 'border-status-critical/30 bg-status-critical/10 text-status-critical'
                                : 'border-surface-4 text-text-secondary hover:border-status-warning/40 hover:text-status-warning')}>
                              {flagged ? t('workspace.purchasing.buttonFlagged') : t('workspace.purchasing.buttonFlagAnomaly')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'EFFICIENCY' && (
        <section className='mt-8'>
          <div className='grid grid-cols-1 gap-8 lg:grid-cols-3'>
            <article className='lg:col-span-2'>
              <div className='mb-4'>
                <p className='text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold'>{t('workspace.purchasing.efficiencySectionLabel')}</p>
                <h3 className='mt-1 font-display text-xl font-semibold text-text-primary'>{t('workspace.purchasing.efficiencySectionTitle')}</h3>
                <p className='mt-1 text-sm text-text-secondary'>{t('workspace.purchasing.efficiencySectionDesc')}</p>
              </div>
              <div className='overflow-x-auto rounded-xl border border-surface-4 bg-surface-2'>
                <table className='w-full min-w-[780px]'>
                  <thead className='border-b border-surface-4/80 bg-surface-3/40'>
                    <tr>{[
                      t('workspace.purchasing.colBranch'),
                      t('workspace.purchasing.colOverOrdering'),
                      t('workspace.purchasing.colEmergencyPurchases'),
                      t('workspace.purchasing.colStockoutPurchases'),
                    ].map((h) => (
                      <th key={h} className='px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted'>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className='divide-y divide-surface-4/50'>
                    {efficiencyRows.map((row) => (
                      <tr key={row.id} className='transition-colors hover:bg-surface-3/20'>
                        <td className='px-4 py-3 text-sm font-semibold text-text-primary'>{row.branch}</td>
                        <td className='px-4 py-3 text-sm text-status-warning'>{row.overOrdering.toFixed(1)}%</td>
                        <td className='px-4 py-3 text-sm text-text-secondary'>{row.emergencyPurchases}</td>
                        <td className='px-4 py-3 text-sm text-text-secondary'>{row.stockoutCausedPurchases}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className='rounded-xl border border-surface-4 bg-surface-2 p-5'>
              <div className='mb-4'>
                <p className='text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold'>{t('workspace.purchasing.compareSectionLabel')}</p>
                <h3 className='mt-1 font-display text-xl font-semibold text-text-primary'>{t('workspace.purchasing.compareSectionTitle')}</h3>
                <p className='mt-1 text-sm text-text-secondary'>{t('workspace.purchasing.compareSectionDesc')}</p>
              </div>
              <div className='space-y-3'>
                <Select options={[{ value: '', label: t('workspace.purchasing.supplierALabel') }, ...supplierRows.map((r) => ({ value: r.id, label: r.supplier }))]}
                  value={supplierA} onChange={(v) => setSupplierA(v)} placeholder={t('workspace.purchasing.selectSupplierAPlaceholder')} />
                <Select options={[{ value: '', label: t('workspace.purchasing.supplierBLabel') }, ...supplierRows.map((r) => ({ value: r.id, label: r.supplier }))]}
                  value={supplierB} onChange={(v) => setSupplierB(v)} placeholder={t('workspace.purchasing.selectSupplierBPlaceholder')} />
              </div>
              <div className='mt-6'>
                <p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted'>{t('workspace.purchasing.spendDeltaLabel')}</p>
                <p className='mt-1 font-display text-[26px] text-text-primary'>{toCurrency(supplierDelta)}</p>
              </div>
              <button type='button'
                className='mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-surface-4 px-4 text-sm text-text-secondary transition-colors hover:border-brand-gold/40 hover:text-brand-gold'>
                <CoinsSwap className='h-4 w-4' /> {t('workspace.purchasing.compareButton')}
              </button>
            </article>
          </div>
        </section>
      )}

      {activeTab === 'FORECAST' && (
        <section className='mt-8'>
          {/* Branch + date range controls */}
          <div className='mb-6 flex flex-wrap items-end gap-4'>
            <div className='min-w-[180px] max-w-xs flex-1'>
              <p className='mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted'>
                Branch
              </p>
              <Select
                options={branchOptions}
                value={forecastBranchId}
                onChange={setForecastBranchId}
                placeholder='Select branch'
                leadingIcon={<Shop className='h-4 w-4' />}
              />
            </div>
            <div className='flex items-end gap-2'>
              <div>
                <p className='mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted'>From</p>
                <input
                  type='date'
                  value={forecastFrom}
                  onChange={(e) => setForecastFrom(e.target.value)}
                  className='h-10 rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary focus:border-brand-gold/60 focus:outline-none focus:ring-1 focus:ring-brand-gold/30'
                />
              </div>
              <div>
                <p className='mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted'>To</p>
                <input
                  type='date'
                  value={forecastTo}
                  onChange={(e) => setForecastTo(e.target.value)}
                  className='h-10 rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary focus:border-brand-gold/60 focus:outline-none focus:ring-1 focus:ring-brand-gold/30'
                />
              </div>
            </div>
          </div>

          {/* Total cost KPI */}
          {forecastQuery.data && forecastQuery.data.total_estimated_cost != null && (
            <div className='mb-6 inline-flex items-baseline gap-3 rounded-xl border border-surface-4 bg-surface-2 px-5 py-3'>
              <p className='text-xs font-semibold uppercase tracking-[0.12em] text-text-muted'>
                Total Estimated Cost
              </p>
              <p className='font-display text-2xl font-semibold text-brand-gold'>
                {toCurrency(forecastQuery.data.total_estimated_cost)}
              </p>
            </div>
          )}

          {/* Header + export */}
          <div className='mb-4 flex items-center justify-between'>
            <div>
              <p className='text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold'>
                Purchase Forecast
              </p>
              <h3 className='mt-1 font-display text-xl font-semibold text-text-primary'>
                Ingredient Purchase Recommendations
              </h3>
              <p className='mt-1 text-sm text-text-secondary'>
                Based on predicted usage over the selected period, netted against on-hand stock.
              </p>
            </div>
            {forecastQuery.data?.lines.length ? (
              <button
                type='button'
                disabled={isReadOnlyBranchManager}
                onClick={() =>
                  downloadCsv(
                    'purchase-forecast.csv',
                    ['Ingredient', 'Unit', 'Predicted Use', 'On Hand', 'Net Need', 'Pack Size', 'Purchase Qty', 'Est. Cost'],
                    (forecastQuery.data?.lines ?? []).map((r: PurchaseForecastLine) => [
                      r.ingredient_name,
                      r.unit,
                      r.predicted_usage.toFixed(2),
                      r.on_hand_qty.toFixed(2),
                      r.net_need.toFixed(2),
                      r.pack_size != null ? r.pack_size.toFixed(2) + ' ' + (r.pack_unit ?? r.unit) : '—',
                      r.purchase_qty.toFixed(2),
                      r.estimated_cost != null ? r.estimated_cost.toFixed(2) : '—',
                    ]),
                  )
                }
                className='inline-flex h-8 items-center gap-1 rounded-lg border border-surface-4 px-2.5 text-sm text-text-primary transition-colors hover:border-brand-gold/40 hover:text-brand-gold disabled:opacity-50'
              >
                <Download className='h-3.5 w-3.5' /> Export
              </button>
            ) : null}
          </div>

          {/* Table */}
          <div className='overflow-x-auto rounded-xl border border-surface-4 bg-surface-2'>
            {forecastQuery.isLoading ? (
              <div className='flex items-center justify-center py-16'>
                <div className='h-5 w-5 animate-spin rounded-full border-2 border-brand-gold border-t-transparent' />
                <span className='ml-3 text-sm text-text-muted'>Calculating forecast…</span>
              </div>
            ) : forecastQuery.isError ? (
              <div className='py-12 text-center'>
                <p className='text-sm text-status-critical'>Failed to load forecast. Check that this branch has ingredient usage data.</p>
              </div>
            ) : !forecastQuery.data?.lines.length ? (
              <div className='py-16 text-center'>
                <p className='text-sm font-semibold text-text-secondary'>No purchase recommendations</p>
                <p className='mt-1 text-xs text-text-muted max-w-sm mx-auto'>
                  No ingredient usage data exists for this period. Run a prep plan to generate ingredient demand forecasts.
                </p>
              </div>
            ) : (
              <table className='w-full min-w-[900px]'>
                <thead className='border-b border-surface-4/80 bg-surface-3/40'>
                  <tr>
                    {['Ingredient', 'Predicted Use', 'On Hand', 'Net Need', 'Pack Size', 'Purchase Qty', 'Est. Cost'].map((h) => (
                      <th key={h} className='px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted'>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className='divide-y divide-surface-4/50'>
                  {forecastQuery.data.lines.map((row: PurchaseForecastLine) => (
                    <tr key={row.ingredient_id} className='transition-colors hover:bg-surface-3/20'>
                      <td className='px-4 py-3 text-sm font-semibold text-text-primary'>{row.ingredient_name}</td>
                      <td className='px-4 py-3 text-sm text-text-secondary'>
                        {row.predicted_usage.toFixed(2)} <span className='text-[11px] uppercase text-text-muted'>{row.unit}</span>
                      </td>
                      <td className='px-4 py-3 text-sm text-text-secondary'>
                        {row.on_hand_qty.toFixed(2)} <span className='text-[11px] uppercase text-text-muted'>{row.unit}</span>
                      </td>
                      <td className={`px-4 py-3 text-sm font-semibold ${row.net_need > 0 ? 'text-status-warning' : 'text-status-success'}`}>
                        {row.net_need.toFixed(2)} <span className='text-[11px] font-normal uppercase text-text-muted'>{row.unit}</span>
                      </td>
                      <td className='px-4 py-3 text-sm text-text-secondary'>
                        {row.pack_size != null ? `${row.pack_size} ${row.pack_unit ?? row.unit}` : '—'}
                      </td>
                      <td className='px-4 py-3 text-sm font-semibold text-brand-gold'>
                        {row.purchase_qty.toFixed(2)} <span className='text-[11px] font-normal uppercase text-text-muted'>{row.pack_unit || row.unit}</span>
                      </td>
                      <td className='px-4 py-3 text-sm text-text-secondary'>
                        {row.estimated_cost != null ? toCurrency(row.estimated_cost) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}
    </WorkspaceShell>
  );
}
