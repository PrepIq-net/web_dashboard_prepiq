"use client";

import { ReactNode } from "react";

interface TableColumn {
  key: string;
  label: string;
  render?: (value: any, row: any) => ReactNode;
}

interface DataTableProps {
  columns: TableColumn[];
  data: any[];
  title?: string;
}

export function DataTable({ columns, data, title }: DataTableProps) {
  return (
    <div className="rounded-card bg-surface-2 border border-border-default shadow-[var(--shadow-level-1)] overflow-hidden">
      {title && (
        <div className="border-b border-border-default px-6 py-4">
          <h3 className="font-display text-lg font-semibold text-text-primary">
            {title}
          </h3>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default bg-surface-3">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-6 py-4 text-left font-semibold text-text-secondary"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr
                key={idx}
                className="border-b border-border-default transition-colors duration-150 hover:bg-surface-3"
              >
                {columns.map((column) => (
                  <td
                    key={`${idx}-${column.key}`}
                    className="px-6 py-4 text-text-primary"
                  >
                    {column.render
                      ? column.render(row[column.key], row)
                      : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
