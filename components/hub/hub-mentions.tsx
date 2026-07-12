"use client";

import type { ConversationMemberInfo } from "@/services/hub";
import { fullName } from "./hub-utils";

export type HubMentionTarget = {
  id: string;
  label: string;
  token: string;
  searchText: string;
  kind: "assistant" | "user";
  subtitle?: string;
  available?: boolean;
};

export type MentionSegment =
  | { type: "text"; value: string }
  | { type: "mention"; value: string; target: HubMentionTarget };

export function buildHubMentionTargets({
  members,
  currentUserId,
  assistantAvailable,
}: {
  members: ConversationMemberInfo[];
  currentUserId: string;
  assistantAvailable: boolean;
}): HubMentionTarget[] {
  const targets: HubMentionTarget[] = [];

  targets.push({
    id: "prepiq-assistant",
    label: "PrepIQ Assistant",
    token: "@PrepIQ",
    searchText: "prepiq assistant prep iq ai",
    kind: "assistant",
    subtitle: "PrepIQ Assistant",
    available: assistantAvailable,
  });

  for (const member of members) {
    if (member.user.id === currentUserId) continue;
    const label = fullName(member.user);
    targets.push({
      id: member.user.id,
      label,
      token: `@${label}`,
      searchText: `${label} ${member.user.email}`.toLowerCase(),
      kind: "user",
      subtitle: member.user.email,
      available: true,
    });
  }

  return targets;
}

function isBoundaryChar(char: string | undefined): boolean {
  if (!char) return true;
  return /[\s.,!?;:)\]}>"'`]/.test(char);
}

export function getActiveMentionContext(
  text: string,
  selectionStart: number | null,
): { start: number; end: number; query: string } | null {
  const cursor = selectionStart ?? text.length;
  const beforeCursor = text.slice(0, cursor);
  const atIndex = beforeCursor.lastIndexOf("@");

  if (atIndex < 0) return null;
  if (atIndex > 0 && !/\s/.test(beforeCursor[atIndex - 1])) return null;

  const query = beforeCursor.slice(atIndex + 1);
  if (/\s/.test(query)) return null;

  return { start: atIndex, end: cursor, query };
}

export function insertMentionToken(
  text: string,
  rangeStart: number,
  rangeEnd: number,
  token: string,
): string {
  const prefix = text.slice(0, rangeStart);
  const suffix = text.slice(rangeEnd);
  const needsSpace = suffix.length > 0 && !/^\s/.test(suffix);
  return `${prefix}${token}${needsSpace ? " " : ""}${suffix}`;
}

export function splitMentionText(
  text: string,
  targets: HubMentionTarget[],
): MentionSegment[] {
  if (!text) return [];

  const orderedTargets = [...targets]
    .filter((target) => target.token)
    .sort((left, right) => right.token.length - left.token.length);

  const segments: MentionSegment[] = [];
  let index = 0;

  while (index < text.length) {
    const current = text[index];

    if (current === "@") {
      const previous = index === 0 ? "" : text[index - 1];
      if (index === 0 || /\s/.test(previous)) {
        const match = orderedTargets.find((target) => {
          const slice = text.slice(index, index + target.token.length);
          if (slice.toLowerCase() !== target.token.toLowerCase()) return false;
          return isBoundaryChar(text[index + target.token.length]);
        });

        if (match) {
          segments.push({
            type: "mention",
            value: text.slice(index, index + match.token.length),
            target: match,
          });
          index += match.token.length;
          continue;
        }
      }
    }

    const nextAt = text.indexOf("@", index + 1);
    const end = nextAt === -1 ? text.length : nextAt;
    segments.push({ type: "text", value: text.slice(index, end) });
    index = end;
  }

  return segments;
}

export function filterMentionTargets(
  targets: HubMentionTarget[],
  query: string,
): HubMentionTarget[] {
  const normalized = query.trim().toLowerCase();
  const visible = targets.filter((target) => target.available !== false);

  return visible
    .filter((target) =>
      normalized.length === 0
        ? true
        : target.searchText.includes(normalized) ||
          target.label.toLowerCase().includes(normalized) ||
          target.token.toLowerCase().includes(normalized),
    )
    .sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "assistant" ? -1 : 1;
      }

      const leftStarts = left.searchText.startsWith(normalized);
      const rightStarts = right.searchText.startsWith(normalized);
      if (leftStarts !== rightStarts) {
        return leftStarts ? -1 : 1;
      }

      return left.label.localeCompare(right.label);
    });
}

export function MentionedText({
  text,
  targets,
  className = "",
  mentionClassName = "",
}: {
  text: string;
  targets: HubMentionTarget[];
  className?: string;
  mentionClassName?: string;
}) {
  const segments = splitMentionText(text, targets);

  return (
    <span className={className}>
      {segments.map((segment, index) =>
        segment.type === "mention" ? (
          <span key={`${segment.value}-${index}`} className={mentionClassName}>
            {segment.value}
          </span>
        ) : (
          <span key={`text-${index}`}>{segment.value}</span>
        ),
      )}
    </span>
  );
}
