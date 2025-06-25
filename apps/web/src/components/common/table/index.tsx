import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@deco/ui/components/table.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import type { ReactNode } from "react";

export interface TableColumn<T> {
  id: string;
  header: ReactNode;
  accessor?: (row: T) => ReactNode;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  cellClassName?: string;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  getRowHref?: (row: T) => string;
}

export function Table<T>({
  columns,
  data,
  sortKey,
  sortDirection,
  onSort,
  onRowClick,
  getRowHref,
}: TableProps<T>) {
  function renderSortIcon(key: string) {
    if (!sortKey || sortKey !== key) {
      return (
        <Icon
          name="arrow_upward"
          size={16}
          className="text-muted-foreground/50"
        />
      );
    }
    return (
      <Icon
        name={sortDirection === "asc" ? "arrow_upward" : "arrow_downward"}
        size={16}
        className="text-muted-foreground"
      />
    );
  }

  function getHeaderClass(idx: number, total: number) {
    let base =
      "px-4 text-left bg-muted font-semibold text-foreground text-sm h-10";
    if (idx === 0) base += " rounded-l-md";
    if (idx === total - 1) base += " rounded-r-md";
    return base;
  }

  return (
    <div className="flex-1 overflow-auto w-full">
      <UITable className="w-full min-w-max">
        <TableHeader className="sticky top-0 z-10 border-b-0 [&>*:first-child]:border-b-0">
          <TableRow className="h-14">
            {columns.map((col, idx) => (
              <TableHead
                key={col.id}
                className={getHeaderClass(idx, columns.length) +
                  " sticky top-0 z-10 bg-muted"}
                style={{ cursor: col.sortable ? "pointer" : undefined }}
                onClick={col.sortable && onSort
                  ? () => onSort(col.id)
                  : undefined}
              >
                <span className="flex items-center gap-1">
                  {col.header}
                  {col.sortable && renderSortIcon(col.id)}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => {
            const href = getRowHref?.(row);
            
            return (
              <TableRow
                key={i}
                className={
                  (href || onRowClick) ? "cursor-pointer hover:bg-muted relative" : ""
                }
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {href && (
                  <a
                    href={href}
                    className="absolute inset-0 z-10"
                    aria-label={`View details for row ${i + 1}`}
                    onClick={(e) => {
                      // Let the anchor handle the navigation
                      // This enables right-click, Ctrl+click, etc.
                      if (e.metaKey || e.ctrlKey || e.button === 1) {
                        return; // Let browser handle
                      }
                      // For regular clicks, we can still handle programmatically if needed
                    }}
                  />
                )}
                {columns.map((col, idx) => (
                  <TableCell
                    key={col.id}
                    className={
                      "px-4 py-2 relative z-20 " +
                      (col.cellClassName ? col.cellClassName + " " : "") +
                      "text-left align-top"
                    }
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
