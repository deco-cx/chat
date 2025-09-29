import { Table, type TableColumn } from "../common/table/index.tsx";
import {
  AgentInfo,
  DateTimeCell,
  UserInfo,
} from "../common/table/table-cells.tsx";

type Thread = {
  id: string;
  resourceId: string;
  title: string;
  metadata?: { agentId: string };
  createdAt: string;
  updatedAt: string;
};

interface AuditTableProps {
  threads: Thread[];
  sort: string;
  onSortChange: (sort: string) => void;
  onRowClick?: (threadId: string) => void;
  columnsDenyList?: Set<string>;
  activeThreadId?: string | null;
  selectedAgent?: string | null;
  selectedUser?: string | null;
}

function getSortKeyAndDirection(sort: string): {
  key: string;
  direction: "asc" | "desc";
} {
  if (sort.endsWith("_asc")) {
    return { key: sort.replace(/_asc$/, ""), direction: "asc" };
  }
  return { key: sort.replace(/_desc$/, ""), direction: "desc" };
}

export function AuditTable({
  threads,
  sort,
  onSortChange,
  onRowClick,
  columnsDenyList,
  activeThreadId,
  selectedAgent,
  selectedUser,
}: AuditTableProps) {
  const { key: sortKey, direction: sortDirection } =
    getSortKeyAndDirection(sort);

  const shouldShowAgent = !selectedAgent;
  const shouldShowUser = !selectedUser || selectedUser === "unknown";

  const allColumns: (TableColumn<Thread> | null)[] = [
    shouldShowAgent
      ? {
          id: "agent",
          header: "Agent",
          rowClassName: "w-[150px]",
          cellClassName: "w-[150px] max-w-[150px]",
          accessor: (cell: Thread) => (
            <AgentInfo agentId={cell.metadata?.agentId} noTooltip />
          ),
        }
      : null,
    shouldShowUser
      ? {
          id: "user",
          header: "Used by",
          rowClassName: "w-[180px]",
          cellClassName: "w-[180px] max-w-[180px]",
          accessor: (cell: Thread) => (
            <UserInfo userId={cell.resourceId} noTooltip />
          ),
        }
      : null,
    {
      id: "title",
      header: "Thread name",
      rowClassName: "min-w-[180px]",
      cellClassName: "min-w-[180px] max-w-[320px]",
      render: (cell: Thread) => (
        <span className="truncate block w-full" title={cell.title}>
          {cell.title}
        </span>
      ),
    },
    {
      id: "createdAt",
      header: "Created at",
      rowClassName: "w-[125px]",
      accessor: (cell: Thread) => <DateTimeCell value={cell.createdAt} />,
      sortable: true,
    },
    {
      id: "updatedAt",
      header: "Last updated",
      rowClassName: "w-[125px]",
      accessor: (cell: Thread) => <DateTimeCell value={cell.updatedAt} />,
      sortable: true,
    },
  ];

  const columns: TableColumn<Thread>[] = allColumns
    .filter((col): col is TableColumn<Thread> => col !== null)
    .filter((col) => !columnsDenyList?.has(col.id));

  function handleSort(colId: string) {
    if (colId === "updatedAt") {
      onSortChange(
        sort === "updatedAt_desc" ? "updatedAt_asc" : "updatedAt_desc",
      );
    } else if (colId === "createdAt") {
      onSortChange(
        sort === "createdAt_desc" ? "createdAt_asc" : "createdAt_desc",
      );
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <Table
        columns={columns}
        data={threads}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        onRowClick={onRowClick ? (row) => onRowClick(row.id) : undefined}
        rowClassName={(row) =>
          row.id === activeThreadId
            ? "bg-primary/15 hover:bg-primary/20"
            : "hover:bg-muted/40"
        }
      />
    </div>
  );
}
