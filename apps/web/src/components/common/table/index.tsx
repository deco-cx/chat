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
}

export function Table<T>({
  columns,
  data,
  sortKey,
  sortDirection,
  onSort,
  onRowClick,
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
    let base = "px-4 py-2 text-left font-medium text-foreground text-sm h-8";
    if (idx === total - 1) base += " w-8";
    return base;
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-y-auto overflow-x-auto w-full border-[1px] border-border rounded-[12px]">
      <UITable className="w-full min-w-max overflow-hidden">
        <TableHeader className="sticky top-0 z-10 border-b-[1px] border-border">
          <TableRow className="h-10 hover:!bg-transparent [&:hover]:!bg-transparent">
            {columns.map((col, idx) => {
              const isActiveSort = sortKey === col.id;
              return (
                <TableHead
                  key={col.id}
                  className={getHeaderClass(idx, columns.length) +
                    " sticky top-0 z-10 group"}
                  style={{ cursor: col.sortable ? "pointer" : undefined }}
                  onClick={col.sortable && onSort
                    ? () => onSort(col.id)
                    : undefined}
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
          {data.map((row, i) => (
            <TableRow
              key={i}
              className={onRowClick ? "cursor-pointer" : ""}
              onClick={onRowClick
                ? () => onRowClick(row)
                : undefined}
            >
              {columns.map((col, _idx) => (
                <TableCell
                  key={col.id}
                  className={"px-4 py-2 " +
                    (col.cellClassName ? col.cellClassName + " " : "") +
                    "truncate overflow-hidden whitespace-nowrap"}
                >
                  {col.render
                    ? col.render(row)
                    : col.accessor
                    ? col.accessor(row)
                    : null}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </UITable>
    </div>
  );
}
