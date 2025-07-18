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
}: AuditTableProps) {
  const { key: sortKey, direction: sortDirection } =
    getSortKeyAndDirection(sort);

  const columns: TableColumn<(typeof threads)[number]>[] = [
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
    {
      id: "agent",
      header: "Agent",
      accessor: (cell: Thread) => (
        <AgentInfo agentId={cell.metadata?.agentId} />
      ),
    },
    {
      id: "user",
      header: "Used by",
      accessor: (cell: Thread) => <UserInfo userId={cell.resourceId} />,
    },
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
  ].filter((col) => !columnsDenyList?.has(col.id));

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
      />
    </div>
  );
}
