import type { HubUser, ReferenceStat } from "@/services/hub";

export function fullName(user: HubUser | null | undefined): string {
  if (!user) return "PrepIQ";
  const name = `${user.first_name} ${user.last_name}`.trim();
  return name || user.email;
}

export function initials(user: HubUser | null | undefined): string {
  if (!user) return "AI";
  const first = user.first_name?.[0] ?? user.email[0];
  const last = user.last_name?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

/** Attachment file URLs come from the backend origin, not the Next proxy. */
export function resolveMediaUrl(mediaOrigin: string, fileUrl: string): string {
  if (!fileUrl) return "";
  if (/^https?:\/\//.test(fileUrl)) return fileUrl;
  return `${mediaOrigin}${fileUrl}`;
}

export function formatBytes(size: number): string {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export const STAT_TONE_CLASSES: Record<ReferenceStat["tone"], string> = {
  neutral: "text-text-secondary",
  ok: "text-status-success",
  warning: "text-status-warning",
  danger: "text-status-critical",
};
