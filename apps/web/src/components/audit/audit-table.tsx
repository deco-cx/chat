import { Table, type TableColumn } from "../common/table/index.tsx";
import {
  AgentInfo,
  DateTimeCell,
  UserInfo,
} from "../common/table/table-cells.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";

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
  const shouldShowUser = !selectedUser;

  const columns: TableColumn<(typeof threads)[number]>[] = [
    shouldShowAgent
      ? {
          id: "agent",
          header: "Agent",
          accessor: (cell: Thread) => (
            <AgentInfo agentId={cell.metadata?.agentId} />
          ),
        }
      : null,
    shouldShowUser
      ? {
          id: "user",
          header: "Used by",
          accessor: (cell: Thread) => <UserInfo userId={cell.resourceId} />,
        }
      : null,
    {
      id: "title",
      header: "Thread name",
      render: (cell: Thread) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="truncate block max-w-xs">{cell.title}</span>
          </TooltipTrigger>
          <TooltipContent className="whitespace-pre-line break-words max-w-xs">
            {cell.title}
          </TooltipContent>
        </Tooltip>
      ),
    },
    {
      id: "updatedAt",
      header: "Last updated",
      accessor: (cell: Thread) => <DateTimeCell value={cell.updatedAt} />,
      sortable: true,
    },
    {
      id: "createdAt",
      header: "Created at",
      accessor: (cell: Thread) => <DateTimeCell value={cell.createdAt} />,
      sortable: true,
    },
  ]
    .filter((col): col is TableColumn<(typeof threads)[number]> => col !== null)
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
    <div className="flex-1 min-h-0 overflow-x-auto">
      <Table
        columns={columns}
        data={threads}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        onRowClick={onRowClick ? (row) => onRowClick(row.id) : undefined}
        rowClassName={(row) =>
          row.id === activeThreadId ? "bg-sidebar/60 hover:bg-sidebar/80" : undefined
        }
      />
    </div>
  );
}
