"use client";

import Link from "next/link";
import {
  Box,
  Calendar,
  Cutlery,
  GraphUp,
  Packages,
  Bell,
  Trash,
  WarningTriangle,
} from "iconoir-react";
import type { HubReference, RefType } from "@/services/hub";
import { STAT_TONE_CLASSES } from "./hub-utils";

const REF_ICONS: Record<RefType, React.ComponentType<{ className?: string }>> = {
  FORECAST: GraphUp,
  RECOMMENDATION: GraphUp,
  RISK: WarningTriangle,
  INGREDIENT: Box,
  MENU_ITEM: Cutlery,
  PREP_BATCH: Packages,
  WASTE_EVENT: Trash,
  CALENDAR_EVENT: Calendar,
  NOTIFICATION: Bell,
};

export function ReferenceCard({ reference }: { reference: HubReference }) {
  const Icon = REF_ICONS[reference.ref_type] ?? Box;
  return (
    <div className="mt-2 rounded-xl border border-border-default bg-surface-3 p-3 max-w-sm">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-4 text-brand-gold">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">
            {reference.title}
          </p>
          {reference.subtitle ? (
            <p className="truncate text-xs text-text-muted">{reference.subtitle}</p>
          ) : null}
        </div>
      </div>
      {reference.stats.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
          {reference.stats.map((stat) => (
            <span key={stat.label} className="text-xs">
              <span className="text-text-muted">{stat.label}: </span>
              <span className={`font-medium ${STAT_TONE_CLASSES[stat.tone] ?? "text-text-secondary"}`}>
                {stat.value}
              </span>
            </span>
          ))}
        </div>
      ) : null}
      {reference.deep_link ? (
        <Link
          href={reference.deep_link}
          className="mt-2.5 inline-flex items-center rounded-lg border border-border-default px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:border-brand-gold hover:text-brand-gold"
        >
          View
        </Link>
      ) : null}
    </div>
  );
}
