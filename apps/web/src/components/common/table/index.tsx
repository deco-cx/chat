import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@deco/ui/components/table.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import type { ReactNode } from "react";

export interface TableColumn<T> {
  id: string;
  header: ReactNode;
  accessor?: (row: T) => ReactNode;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  rowClassName?: string;
  cellClassName?: string;
  wrap?: boolean;
}

export interface TableProps<T = Record<string, unknown>> {
  columns: TableColumn<T>[];
  data: T[];
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
}

export function Table<T = Record<string, unknown>>({
  columns,
  data,
  sortKey,
  sortDirection,
  onSort,
  onRowClick,
  rowClassName,
}: TableProps<T>) {
  function renderSortIcon(_key: string, isActive: boolean) {
    // Only show icon if this column is actively sorted
    if (!isActive) {
      return null;
    }

    return (
      <Icon
        name={sortDirection === "asc" ? "arrow_downward" : "arrow_upward"}
        size={16}
        className="text-foreground group-hover:text-muted-foreground transition-colors"
      />
    );
  }

  function renderHoverSortIcon() {
    return (
      <Icon
        name="arrow_downward"
        size={16}
        className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
      />
    );
  }

  function getHeaderClass(idx: number, total: number) {
    let base = "px-3 py-2 text-left font-medium text-foreground text-sm h-8";
    if (idx === total - 1) base += " w-8";
    return base;
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-y-auto overflow-x-auto w-full border border-border rounded-xl bg-background">
      <UITable className="w-full border-collapse table-fixed">
        <TableHeader className="sticky top-0 z-10 border-b-[1px] border-border">
          <TableRow className="h-10 hover:!bg-transparent [&:hover]:!bg-transparent">
            {columns.map((col, idx) => {
              const isActiveSort = sortKey === col.id;
              return (
                <TableHead
                  key={col.id}
                  className={
                    getHeaderClass(idx, columns.length) +
                    " sticky top-0 z-10 group " +
                    col.rowClassName
                  }
                  style={{ cursor: col.sortable ? "pointer" : undefined }}
                  onClick={
                    col.sortable && onSort ? () => onSort(col.id) : undefined
                  }
                >
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <>
                        {renderSortIcon(col.id, isActiveSort)}
                        {!isActiveSort && renderHoverSortIcon()}
                      </>
                    )}
                  </span>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => {
            const extraClasses = rowClassName?.(row);

            return (
              <TableRow
                key={i}
                data-row-index={i}
                className={cn(
                  "group/data-row transition-colors border-b border-border/60 last:border-b-0",
                  onRowClick ? "cursor-pointer" : "",
                  extraClasses,
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.id}
                    className={cn(
                      "px-3 py-2 align-top min-w-0",
                      col.cellClassName,
                      col.wrap
                        ? "whitespace-normal break-words"
                        : "truncate overflow-hidden whitespace-nowrap",
                    )}
                  >
                    {col.render
                      ? col.render(row)
                      : col.accessor
                        ? col.accessor(row)
                        : null}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </UITable>
    </div>
  );
}
