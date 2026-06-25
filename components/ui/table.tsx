import React from "react";

type Column<T> = {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
  render?: (row: T) => React.ReactNode;
};

type TableProps<T> = {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
};

export function Table<T>({ columns, data, rowKey }: TableProps<T>) {
  return (
    <div className="rounded-2xl border border-[#1C1C1F] overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead className="bg-[#1C1C1F]/50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-6 py-4 text-sm font-semibold uppercase tracking-wider text-text-muted ${column.headerClassName ?? ""}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-[#1C1C1F]/50">
          {data.map((row) => (
            <tr
              key={rowKey(row)}
              className="hover:bg-[#1C1C1F]/20 transition-colors"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-6 py-5 ${column.className ?? ""}`}
                >
                  {column.render
                    ? column.render(row)
                    : (row as any)[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
