"use client";

import { useEffect, useState } from "react";
import type { AssistantMessage as AssistantMessageType } from "@/services/assistant/types";

// Renders **bold** and bullet-point lines from model output without a library.
function renderContent(text: string) {
  const parts: React.ReactNode[] = [];
  text.split("\n").forEach((line, li) => {
    const isBullet = /^(\s*[-•*]\s)/.test(line);
    const stripped = isBullet ? line.replace(/^(\s*[-•*]\s)/, "") : line;

    // Process **bold** spans
    const bold: React.ReactNode[] = [];
    const segments = stripped.split(/\*\*(.+?)\*\*/g);
    segments.forEach((seg, si) => {
      if (si % 2 === 1) {
        bold.push(<strong key={si} className="font-semibold">{seg}</strong>);
      } else if (seg) {
        bold.push(seg);
      }
    });

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
  });
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
