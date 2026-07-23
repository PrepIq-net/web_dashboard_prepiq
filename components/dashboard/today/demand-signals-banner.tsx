"use client";

import { useMemo, useState, type ComponentType } from "react";
import {
  GraphUp,
  Clock,
  Cloud,
  Rain,
  SunLight,
  SnowFlake,
  Car,
  HistoricShield,
  Calendar,
  CalendarPlus,
  EditPencil,
  StatsUpSquare,
  Globe,
  ArrowUpRight,
  ArrowDownRight,
  NavArrowRight,
} from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import { ModalShell } from "@/components/ui/modal-shell";
import type { BranchDayToday } from "@/services/production-intelligence/types";
import type { Translator } from "./today-helpers";

/**
 * Demand Signals — the proof that PrepIQ reads operational variables before
 * the kitchen opens. One card per signal, each number aggregated from its real
 * source on the backend (signal_cards.py). Active signals carry status color
 * and open a micro-modal with the exact parameters behind the baseline;
 * quiet signals stay legible but muted so the strip reads as evidence, not noise.
 */

type SignalCard = NonNullable<BranchDayToday["signal_cards"]>[number];
type SignalStatus = SignalCard["status"];

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  sales_trends: GraphUp,
  operating_hours: Clock,
  weather: Cloud,
  traffic: Car,
  stockout_history: HistoricShield,
  day_of_week: Calendar,
  events_holidays: CalendarPlus,
  chef_adjustments: EditPencil,
  macro_trends: StatsUpSquare,
  network: Globe,
};

/** Weather gets a condition-aware glyph so the card looks like it knows. */
function weatherIcon(card: SignalCard): ComponentType<{ className?: string }> {
  const text = `${card.headline ?? ""} ${card.detail}`.toLowerCase();
  if (text.includes("rain") || text.includes("storm") || text.includes("shower"))
    return Rain;
  if (text.includes("snow")) return SnowFlake;
  if (text.includes("clear") || text.includes("sun")) return SunLight;
  return Cloud;
}

function iconFor(card: SignalCard): ComponentType<{ className?: string }> {
  if (card.key === "weather") return weatherIcon(card);
  return ICONS[card.key] ?? GraphUp;
}

const STATUS_TOKENS: Record<
  SignalStatus,
  { icon: string; ring: string; headline: string; dot: string }
> = {
  up: {
    icon: "bg-status-success/12 text-status-success",
    ring: "border-status-success/30",
    headline: "text-status-success",
    dot: "bg-status-success",
  },
  down: {
    icon: "bg-status-critical/12 text-status-critical",
    ring: "border-status-critical/30",
    headline: "text-status-critical",
    dot: "bg-status-critical",
  },
  attention: {
    icon: "bg-status-warning/12 text-status-warning",
    ring: "border-status-warning/30",
    headline: "text-status-warning",
    dot: "bg-status-warning",
  },
  neutral: {
    icon: "bg-surface-3 text-text-muted",
    ring: "border-surface-4",
    headline: "text-text-secondary",
    dot: "bg-surface-4",
  },
};

function cardLabel(t: Translator, key: string): string {
  const localized = t(`today.signalCard.${key}`);
  return localized.startsWith("today.signalCard.") ? key : localized;
}

function DirectionArrow({ status }: { status: SignalStatus }) {
  if (status === "up")
    return <ArrowUpRight className="h-3.5 w-3.5 text-status-success" />;
  if (status === "down")
    return <ArrowDownRight className="h-3.5 w-3.5 text-status-critical" />;
  return null;
}

function SignalTile({
  card,
  label,
  onOpen,
}: {
  card: SignalCard;
  label: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const Icon = iconFor(card);
  const tokens = STATUS_TOKENS[card.status];
  const clickable = card.params.length > 0;

  const inner = (
    <>
      <div className="flex items-start justify-between">
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${tokens.icon}`}
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
        {card.active ? (
          <span
            className={`mt-1 h-1.5 w-1.5 rounded-full ${tokens.dot} ${
              card.status !== "neutral" ? "animate-pulse" : ""
            }`}
            aria-hidden
          />
        ) : null}
      </div>
      <p className="mt-2.5 text-[11px] font-medium leading-tight text-text-muted">
        {label}
      </p>
      <div className="mt-0.5 flex items-center gap-1">
        {card.headline ? (
          <span
            className={`font-display text-base font-semibold leading-tight ${tokens.headline}`}
          >
            {card.headline}
          </span>
        ) : (
          <span className="text-xs text-text-muted">
            {t("today.signalCard.quiet")}
          </span>
        )}
        <DirectionArrow status={card.status} />
      </div>
    </>
  );

  const base =
    "flex flex-col rounded-xl border bg-surface-2 px-3 py-3 text-left shadow-[var(--shadow-level-1)] transition-all duration-150";

  if (!clickable) {
    return <div className={`${base} ${tokens.ring}`}>{inner}</div>;
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${base} ${tokens.ring} hover:-translate-y-0.5 hover:border-brand-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/30`}
    >
      {inner}
    </button>
  );
}

export function DemandSignalsBanner({
  branchDay,
}: {
  branchDay: BranchDayToday;
}) {
  const { t } = useTranslation();
  const [openKey, setOpenKey] = useState<string | null>(null);

  const cards = branchDay.signal_cards ?? [];
  const activeCount = useMemo(
    () => cards.filter((card) => card.active).length,
    [cards],
  );
  const openCard = cards.find((card) => card.key === openKey) ?? null;

  if (cards.length === 0) return null;

  const openTokens = openCard ? STATUS_TOKENS[openCard.status] : null;
  const OpenIcon = openCard ? iconFor(openCard) : null;

  return (
    <section className="mb-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {t("today.signalsBanner.title")}
          </p>
          <span className="text-[11px] text-text-muted">
            {t("today.signalsBanner.activeCount", {
              active: activeCount,
              total: cards.length,
            })}
          </span>
        </div>
        <p className="text-[11px] text-text-muted">
          {t("today.signalsBanner.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
        {cards.map((card) => (
          <SignalTile
            key={card.key}
            card={card}
            label={cardLabel(t, card.key)}
            onOpen={() => setOpenKey(card.key)}
          />
        ))}
      </div>

      <ModalShell
        open={Boolean(openCard)}
        title={openCard ? cardLabel(t, openCard.key) : ""}
        onClose={() => setOpenKey(null)}
        maxWidthClassName="max-w-md"
      >
        {openCard && openTokens && OpenIcon ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${openTokens.icon}`}
              >
                <OpenIcon className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                {openCard.headline ? (
                  <p
                    className={`font-display text-2xl font-semibold leading-none ${openTokens.headline}`}
                  >
                    {openCard.headline}
                  </p>
                ) : null}
                <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                  {openCard.detail}
                </p>
              </div>
            </div>

            {openCard.params.length > 0 ? (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  <NavArrowRight className="h-3 w-3" />
                  {t("today.signalsBanner.behindThis")}
                </p>
                <dl className="divide-y divide-surface-4/60 overflow-hidden rounded-lg border border-surface-4 bg-surface-3/30">
                  {openCard.params.map((param) => (
                    <div
                      key={param.label}
                      className="flex items-center justify-between gap-4 px-3.5 py-2.5"
                    >
                      <dt className="text-xs text-text-muted">{param.label}</dt>
                      <dd className="text-right text-xs font-semibold tabular-nums text-text-primary">
                        {param.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}

            <p className="text-[11px] leading-relaxed text-text-muted">
              {t("today.signalsBanner.sourceNote")}
            </p>
          </div>
        ) : null}
      </ModalShell>
    </section>
  );
}
