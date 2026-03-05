"use client";

import type { ReactNode } from "react";

type CellContext<TData, TValue> = {
  getValue: () => TValue;
  row: {
    original: TData;
  };
};

type HeaderContext = Record<string, never>;

type ColumnDef<TData> = {
  id: string;
  header: ReactNode | ((context: HeaderContext) => ReactNode);
  cell: (context: CellContext<TData, unknown>) => ReactNode;
  accessorKey?: keyof TData;
};

type Header<TData> = {
  id: string;
  isPlaceholder: false;
  column: { columnDef: ColumnDef<TData> };
  getContext: () => HeaderContext;
};

type Cell<TData> = {
  id: string;
  column: { columnDef: ColumnDef<TData> };
  getContext: () => CellContext<TData, unknown>;
};

type Row<TData> = {
  id: string;
  original: TData;
  getVisibleCells: () => Cell<TData>[];
};

type HeaderGroup<TData> = {
  id: string;
  headers: Header<TData>[];
};

export type NativeTableModel<TData> = {
  getHeaderGroups: () => HeaderGroup<TData>[];
  getRowModel: () => { rows: Row<TData>[] };
};

type UseNativeTableOptions<TData> = {
  data: TData[];
  columns: ColumnDef<TData>[];
  getCoreRowModel?: unknown;
};

type NativeTableProps<TData> = {
  table: NativeTableModel<TData>;
  tableClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  headerCellClassName?: string | ((header: Header<TData>) => string);
  bodyRowClassName?: string | ((row: Row<TData>) => string);
  cellClassName?: string | ((cell: Cell<TData>) => string);
};

type AccessorColumnOptions<TData, TValue> = {
  header: ReactNode | ((context: HeaderContext) => ReactNode);
  cell?: (context: CellContext<TData, TValue>) => ReactNode;
};

type DisplayColumnOptions<TData> = {
  id: string;
  header: ReactNode | ((context: HeaderContext) => ReactNode);
  cell: (context: CellContext<TData, unknown>) => ReactNode;
};

export function createColumnHelper<TData>() {
  return {
    accessor<TKey extends keyof TData>(
      accessorKey: TKey,
      options: AccessorColumnOptions<TData, TData[TKey]>,
    ): ColumnDef<TData> {
      return {
        id: String(accessorKey),
        accessorKey,
        header: options.header,
        cell:
          options.cell ??
          ((context) => {
            const value = context.getValue();
            return value == null ? null : String(value);
          }),
      } as ColumnDef<TData>;
    },
    display(options: DisplayColumnOptions<TData>): ColumnDef<TData> {
      return {
        id: options.id,
        header: options.header,
        cell: options.cell,
      };
    },
  };
}

export function getCoreRowModel() {
  // Compatibility no-op for existing page code paths.
  return null;
}

export function useReactTable<TData>({
  data,
  columns,
}: UseNativeTableOptions<TData>): NativeTableModel<TData> {
  return {
    getHeaderGroups: () => [
      {
        id: "header",
        headers: columns.map((column) => ({
          id: column.id,
          isPlaceholder: false as const,
          column: { columnDef: column },
          getContext: () => ({}),
        })),
      },
    ],
    getRowModel: () => ({
      rows: data.map((item, rowIndex) => ({
        id: String(rowIndex),
        original: item,
        getVisibleCells: () =>
          columns.map((column, colIndex) => ({
            id: `${rowIndex}-${colIndex}`,
            column: { columnDef: column },
            getContext: () => ({
              getValue: () =>
                column.accessorKey ? (item[column.accessorKey] as unknown) : undefined,
              row: { original: item },
            }),
          })),
      })),
    }),
  };
}

export function flexRender<TContext>(
  renderer: ReactNode | ((context: TContext) => ReactNode),
  context: TContext,
): ReactNode {
  if (typeof renderer === "function") {
    return (renderer as (ctx: TContext) => ReactNode)(context);
  }
  return renderer;
}

export function NativeTable<TData>({
  table,
  tableClassName = "w-full",
  headerClassName,
  bodyClassName,
  headerCellClassName,
  bodyRowClassName,
  cellClassName,
}: NativeTableProps<TData>) {
  return (
    <table className={tableClassName}>
      <thead className={headerClassName}>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th
                key={header.id}
                className={
                  typeof headerCellClassName === "function"
                    ? headerCellClassName(header)
                    : headerCellClassName ??
                      "px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted"
                }
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody className={bodyClassName}>
        {table.getRowModel().rows.map((row) => (
          <tr
            key={row.id}
            className={
              typeof bodyRowClassName === "function"
                ? bodyRowClassName(row)
                : bodyRowClassName
            }
          >
            {row.getVisibleCells().map((cell) => (
              <td
                key={cell.id}
                className={
                  typeof cellClassName === "function"
                    ? cellClassName(cell)
                    : cellClassName ?? "px-4 py-3"
                }
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
