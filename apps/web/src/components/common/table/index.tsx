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
import { EmptyState } from "../empty-state.tsx";

export interface TableColumn<T> {
  id: string;
  header: ReactNode;
  accessor?: (row: T) => ReactNode;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  cellClassName?: string;
  headerClassName?: string;
}

/**
 * Configuration for table empty state
 * 
 * @example Basic empty state
 * ```tsx
 * emptyState={{
 *   icon: "table_view",
 *   title: "No data",
 *   description: "No items to display"
 * }}
 * ```
 * 
 * @example With action button
 * ```tsx
 * emptyState={{
 *   icon: "add",
 *   title: "No items yet",
 *   description: "Create your first item to get started",
 *   buttonProps: {
 *     children: "Create Item",
 *     onClick: () => handleCreate()
 *   }
 * }}
 * ```
 * 
 * @example With custom button component
 * ```tsx
 * emptyState={{
 *   icon: "integration_instructions",
 *   title: "No connections",
 *   description: "Connect services to expand functionality",
 *   buttonComponent: <SelectConnectionDialog />
 * }}
 * ```
 */
export interface TableEmptyStateProps {
  /** Material icon name for the empty state - defaults to "table_view" */
  icon?: string;
  /** Main title text - defaults to "No data available" */
  title?: string;
  /** Description text or ReactNode - defaults to generic message */
  description?: string | ReactNode;
  /** Props for the default button - mutually exclusive with buttonComponent */
  buttonProps?: React.ComponentProps<typeof EmptyState>["buttonProps"];
  /** Custom button component - overrides buttonProps */
  buttonComponent?: ReactNode;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  /** Configuration for empty state when data is empty */
  emptyState?: TableEmptyStateProps;
}

/**
 * Enhanced table component with built-in sorting and empty state support
 * 
 * Features:
 * - Automatic sorting with visual indicators
 * - Hover effects and proper icon orientation  
 * - Built-in empty state with EmptyState component
 * - Design system compliant (48px header, proper borders, etc.)
 * 
 * @example Basic usage
 * ```tsx
 * <Table
 *   columns={columns}
 *   data={items}
 *   sortKey={sortKey}
 *   sortDirection={sortDirection}
 *   onSort={handleSort}
 *   emptyState={{
 *     icon: "inventory_2",
 *     title: "No items found",
 *     description: "Try adjusting your search or create a new item"
 *   }}
 * />
 * ```
 */
export function Table<T>({
  columns,
  data,
  sortKey,
  sortDirection,
  onSort,
  onRowClick,
  emptyState,
}: TableProps<T>) {
  function renderSortIcon(key: string) {
    if (!sortKey || sortKey !== key) {
      return null;
    }
    return (
      <Icon
        name={sortDirection === "asc" ? "arrow_downward" : "arrow_upward"}
        size={16}
        className="text-foreground group-hover:text-muted-foreground ml-2 transition-colors"
      />
    );
  }

  function renderHoverIcon() {
    return (
      <Icon
        name="arrow_downward"
        size={16}
        className="text-muted-foreground ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
      />
    );
  }

  // Show empty state if no data and emptyState is provided
  if (data.length === 0 && emptyState) {
    return (
      <div className="flex flex-1 min-h-[400px] items-center justify-center">
        <EmptyState
          icon={emptyState.icon || "table_view"}
          title={emptyState.title || "No data available"}
          description={emptyState.description || "There are no items to display in this table."}
          buttonProps={emptyState.buttonProps}
          buttonComponent={emptyState.buttonComponent}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-y-auto overflow-x-auto w-full">
      <UITable className="w-full min-w-max">
        <TableHeader className="sticky top-0 z-10 border-b border-border">
          <TableRow className="h-12 hover:bg-transparent">
            {columns.map((col, idx) => (
              <TableHead
                key={col.id}
                className={`sticky top-0 z-10 cursor-pointer group hover:bg-transparent ${col.headerClassName || ''}`}
                onClick={col.sortable && onSort
                  ? () => onSort(col.id)
                  : undefined}
              >
                <div className="flex items-center">
                  {col.header}
                  {col.sortable && (
                    <>
                      {renderSortIcon(col.id)}
                      {(!sortKey || sortKey !== col.id) && renderHoverIcon()}
                    </>
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="text-center py-8 text-muted-foreground"
              >
                No data available
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, i) => (
              <TableRow
                key={i}
                className={onRowClick ? "cursor-pointer hover:bg-muted" : ""}
                onClick={onRowClick
                  ? () => onRowClick(row)
                  : undefined}
              >
                {columns.map((col, idx) => (
                  <TableCell
                    key={col.id}
                    className={(col.cellClassName ? col.cellClassName + " " : "") +
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
            ))
          )}
        </TableBody>
      </UITable>
    </div>
  );
}
