"use client";

import { useEffect, useState } from "react";
import type { AssistantMessage as AssistantMessageType } from "@/services/assistant/types";

// Splits **bold** spans out of a line of text.
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const segments = text.split(/\*\*(.+?)\*\*/g);
  segments.forEach((seg, si) => {
    if (si % 2 === 1) {
      nodes.push(<strong key={si} className="font-semibold">{seg}</strong>);
    } else if (seg) {
      nodes.push(seg);
    }
  });
  return nodes;
}

const TABLE_ROW_RE = /^\s*\|(.+)\|\s*$/;
const TABLE_SEPARATOR_RE = /^\s*\|?[\s:|-]+\|?\s*$/;

function splitTableRow(line: string): string[] {
  const match = line.match(TABLE_ROW_RE);
  const inner = match ? match[1] : line;
  return inner.split("|").map((cell) => cell.trim());
}

function renderTable(key: string, rows: string[]): React.ReactNode {
  const header = splitTableRow(rows[0]);
  const bodyRows = rows.slice(2).map(splitTableRow);
  return (
    <div key={key} className="my-1 overflow-x-auto rounded-lg border border-surface-4">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-surface-4 bg-surface-3">
            {header.map((cell, ci) => (
              <th
                key={ci}
                className="px-2.5 py-1.5 text-left font-semibold text-text-primary"
              >
                {renderInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, ri) => (
            <tr key={ri} className="border-b border-surface-4/60 last:border-0">
              {row.map((cell, ci) => (
                <td key={ci} className="px-2.5 py-1.5 text-text-secondary">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Renders **bold**, bullet-point lines, and pipe-delimited tables from model
// output without a markdown library.
function renderContent(text: string) {
  const parts: React.ReactNode[] = [];
  const lines = text.split("\n");
  let li = 0;
  while (li < lines.length) {
    const line = lines[li];

    // Markdown table: header row, separator row, then >=0 data rows.
    if (
      TABLE_ROW_RE.test(line) &&
      li + 1 < lines.length &&
      TABLE_SEPARATOR_RE.test(lines[li + 1]) &&
      lines[li + 1].includes("-")
    ) {
      const tableLines = [line, lines[li + 1]];
      let cursor = li + 2;
      while (cursor < lines.length && TABLE_ROW_RE.test(lines[cursor])) {
        tableLines.push(lines[cursor]);
        cursor++;
      }
      parts.push(renderTable(`table-${li}`, tableLines));
      li = cursor;
      continue;
    }

    const isBullet = /^(\s*[-•*]\s)/.test(line);
    const stripped = isBullet ? line.replace(/^(\s*[-•*]\s)/, "") : line;
    const bold = renderInline(stripped);

    if (isBullet) {
      parts.push(
        <div key={li} className="flex gap-1.5">
          <span className="mt-0.5 shrink-0 text-brand-gold">•</span>
          <span>{bold}</span>
        </div>,
      );
    } else if (line.startsWith("### ") || line.startsWith("## ")) {
      const heading = line.replace(/^#{2,3}\s/, "");
      parts.push(
        <p key={li} className="font-semibold text-text-primary">{heading}</p>,
      );
    } else if (bold.length > 0) {
      parts.push(<span key={li}>{bold}</span>);
      parts.push(<br key={`${li}-br`} />);
    } else {
      parts.push(<span key={li}>{line}</span>);
      parts.push(<br key={`${li}-br`} />);
    }
    li++;
  }
  return parts;
}

export function AssistantMessageBubble({
  message,
  animateIn,
}: {
  message: AssistantMessageType;
  animateIn?: boolean;
}) {
  const isUser = message.role === "user";
  const fullText = message.content ?? "";

  const [displayed, setDisplayed] = useState(animateIn && !isUser ? "" : fullText);
  const [done, setDone] = useState(!animateIn || isUser);

  useEffect(() => {
    if (!animateIn || isUser) {
      setDisplayed(fullText);
      setDone(true);
      return;
    }
    setDisplayed("");
    setDone(false);
    let i = 0;
    // ~14ms per char ≈ 70 chars/sec — feels like ChatGPT
    const id = setInterval(() => {
      i++;
      setDisplayed(fullText.slice(0, i));
      if (i >= fullText.length) {
        clearInterval(id);
        setDone(true);
      }
    }, 14);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id, animateIn]);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] wrap-break-word rounded-xl rounded-br-md bg-brand-gold px-3.5 py-2.5 text-sm leading-relaxed text-surface-1">
          {fullText}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      {/* Assistant avatar */}
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-[11px] font-bold text-brand-gold">
        IQ
      </div>
      <div className="max-w-[82%] min-w-0">
        <div className="rounded-xl rounded-bl-md border border-surface-4 bg-surface-2 px-3.5 py-2.5 text-sm leading-relaxed text-text-primary">
          <div className="space-y-0.5 wrap-break-word">
            {renderContent(displayed)}
            {!done ? (
              <span className="inline-block h-3.5 w-0.5 animate-pulse bg-brand-gold align-middle" />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
