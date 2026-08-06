"use client";

import { motion } from "framer-motion";
import { Headset } from "iconoir-react";

type TodaysBriefTriggerProps = {
  /** Must match the modal's layoutId — this is the morph's other half. */
  layoutId: string;
  label: string;
  hint: string;
  loading: boolean;
  onClick: () => void;
};

/**
 * The page's single gold element.
 *
 * Gold is scarce here (DESIGN.md §2) and this takes the budget from the
 * "Open briefing" link in MorningBriefStrip, which is now neutral. Two reasons:
 * this is the more direct action, and it is the only one present in all three
 * phases — a manager arriving mid-service can still catch up on the day.
 *
 * Iconoir `Headset` rather than a 🎧 emoji: the design system mandates the icon
 * set, and an emoji would render differently on every platform.
 */
export function TodaysBriefTrigger({
  layoutId,
  label,
  hint,
  loading,
  onClick,
}: TodaysBriefTriggerProps) {
  return (
    <motion.button
      layoutId={layoutId}
      type="button"
      onClick={onClick}
      disabled={loading}
      title={hint}
      aria-label={hint}
      className="inline-flex h-9 items-center gap-2 rounded-button bg-brand-gold px-3.5 text-sm font-semibold text-surface-1 transition-colors hover:bg-brand-gold-hover disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
    >
      <Headset width="1.05em" height="1.05em" strokeWidth={1.5} />
      {label}
    </motion.button>
  );
}
