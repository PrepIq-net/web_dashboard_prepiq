"use client";

import { useState } from "react";
import { Download, MusicDoubleNote, Page, Table2Columns } from "iconoir-react";
import type { HubAttachment } from "@/services/hub";
import { formatBytes, resolveMediaUrl } from "./hub-utils";

export function AttachmentView({
  attachment,
  mediaOrigin,
}: {
  attachment: HubAttachment;
  mediaOrigin: string;
}) {
  const url = resolveMediaUrl(mediaOrigin, attachment.file_url);

  if (attachment.kind === "IMAGE") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-2 block max-w-xs">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={attachment.original_name}
          className="max-h-64 rounded-xl border border-border-default object-cover"
        />
      </a>
    );
  }

  if (attachment.kind === "AUDIO") {
    return (
      <div className="mt-2 flex max-w-sm items-center gap-2 rounded-xl border border-border-default bg-surface-3 p-2.5">
        <MusicDoubleNote className="h-4 w-4 flex-shrink-0 text-text-muted" />
        <audio controls preload="none" src={url} className="h-8 w-full" />
      </div>
    );
  }

  if (attachment.kind === "VIDEO") {
    return (
      <video
        controls
        preload="metadata"
        src={url}
        className="mt-2 max-h-64 max-w-sm rounded-xl border border-border-default"
      />
    );
  }

  const table = attachment.preview?.table;
  if (table) {
    return <CsvPreview attachment={attachment} url={url} />;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 flex max-w-sm items-center gap-2.5 rounded-xl border border-border-default bg-surface-3 p-3 transition-colors hover:border-brand-gold"
    >
      <Page className="h-5 w-5 flex-shrink-0 text-text-muted" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-text-primary">
          {attachment.original_name}
        </span>
        <span className="block text-xs text-text-muted">
          {attachment.kind}
          {attachment.preview?.page_count
            ? ` · ${attachment.preview.page_count} pages`
            : ""}
          {attachment.size_bytes ? ` · ${formatBytes(attachment.size_bytes)}` : ""}
          {attachment.status === "PENDING" ? " · processing…" : ""}
          {attachment.preview?.needs_ocr ? " · scanned (no text layer)" : ""}
        </span>
      </span>
      <Download className="h-4 w-4 flex-shrink-0 text-text-muted" />
    </a>
  );
}

function CsvPreview({ attachment, url }: { attachment: HubAttachment; url: string }) {
  const [expanded, setExpanded] = useState(false);
  const table = attachment.preview.table!;
  const rows = expanded ? table.rows : table.rows.slice(0, 4);

  return (
    <div className="mt-2 max-w-md overflow-hidden rounded-xl border border-border-default bg-surface-3">
      <div className="flex items-center gap-2 border-b border-border-default px-3 py-2">
        <Table2Columns className="h-4 w-4 text-text-muted" />
        <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
          {attachment.original_name}
        </span>
        <span className="text-xs text-text-muted">{table.total_rows} rows</span>
        <a href={url} target="_blank" rel="noreferrer" className="text-text-muted hover:text-brand-gold">
          <Download className="h-4 w-4" />
        </a>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-default">
              {table.columns.map((column) => (
                <th
                  key={column}
                  className="whitespace-nowrap px-3 py-1.5 text-left font-medium text-text-secondary"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-b border-surface-4 last:border-0">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="whitespace-nowrap px-3 py-1.5 text-text-muted">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.rows.length > 4 ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="w-full border-t border-border-default py-1.5 text-xs text-text-muted transition-colors hover:text-brand-gold"
        >
          {expanded ? "Show less" : `Show ${table.rows.length - 4} more rows`}
        </button>
      ) : null}
    </div>
  );
}
