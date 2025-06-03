import {
  type Integration,
  useIntegrations,
  useRemoveIntegration,
} from "@deco/sdk";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { type MouseEvent, useReducer, useState } from "react";
import { trackEvent } from "../../../hooks/analytics.ts";
import { useNavigateWorkspace } from "../../../hooks/use-navigate-workspace.ts";
import { EmptyState } from "../../common/empty-state.tsx";
import { Table, TableColumn } from "../../common/table/index.tsx";
import { IntegrationInfo } from "../../common/table/table-cells.tsx";
import { Header, IntegrationPageLayout } from "./breadcrumb.tsx";
import { IntegrationIcon } from "./common.tsx";

const INTEGRATION_ID_DENYLIST = [
  "i:workspace-management",
  "i:user-management",
  "i:knowledge-base",
];

interface IntegrationActionsProps {
  onDelete: () => void;
  disabled?: boolean;
}
function IntegrationActions({ onDelete, disabled }: IntegrationActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="focus:bg-accent/30"
          disabled={disabled}
        >
          <Icon name="more_vert" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={onDelete}
          className="text-destructive focus:bg-destructive/10"
        >
          <Icon name="delete" className="mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function IntegrationCard({
  integration,
  onConfigure,
  onDelete,
}: {
  integration: Integration;
  onConfigure: (integration: Integration) => void;
  onDelete: (integrationId: string) => void;
}) {
  return (
    <Card
      className="group cursor-pointer hover:shadow-md transition-shadow rounded-xl relative border-border"
      onClick={() => onConfigure(integration)}
    >
      <CardContent className="p-4">
        <div className="grid grid-cols-[min-content_1fr_min-content] gap-4 items-start">
          <IntegrationIcon
            icon={integration.icon}
            name={integration.name}
            className="h-16 w-16"
          />

          <div className="flex flex-col gap-1 min-w-0">
            <div className="text-base font-semibold truncate">
              {integration.name}
            </div>
            <div className="text-sm text-muted-foreground line-clamp-3">
              {integration.description}
            </div>
          </div>

          <div onClick={(e) => e.stopPropagation()}>
            {!INTEGRATION_ID_DENYLIST.some((id) =>
              integration.id.startsWith(id)
            ) && (
              <IntegrationActions onDelete={() => onDelete(integration.id)} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ListState {
  filter: string;
  deleteDialogOpen: boolean;
  integrationToDelete: string | null;
  deleting: boolean;
}

type ListAction =
  | { type: "SET_FILTER"; payload: string }
  | { type: "CONFIRM_DELETE"; payload: string }
  | { type: "CANCEL_DELETE" }
  | { type: "DELETE_START" }
  | { type: "DELETE_END" };

const initialState: ListState = {
  filter: "",
  deleteDialogOpen: false,
  integrationToDelete: null,
  deleting: false,
};

function listReducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case "SET_FILTER": {
      return { ...state, filter: action.payload };
    }
    case "CONFIRM_DELETE": {
      return {
        ...state,
        deleteDialogOpen: true,
        integrationToDelete: action.payload,
      };
    }
    case "CANCEL_DELETE": {
      return { ...state, deleteDialogOpen: false, integrationToDelete: null };
    }
    case "DELETE_START": {
      return { ...state, deleting: true };
    }
    case "DELETE_END": {
      return {
        ...state,
        deleting: false,
        deleteDialogOpen: false,
        integrationToDelete: null,
      };
    }
    default: {
      return state;
    }
  }
}

function CardsView(
  { integrations, onConfigure, onDelete }: {
    integrations: Integration[];
    onConfigure: (integration: Integration) => void;
    onDelete: (integrationId: string) => void;
  },
) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 peer">
      {integrations.map((integration) => (
        <IntegrationCard
          key={integration.id}
          integration={integration}
          onConfigure={onConfigure}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function TableView(
  { integrations, onConfigure, onDelete }: {
    integrations: Integration[];
    onConfigure: (integration: Integration) => void;
    onDelete: (integrationId: string) => void;
  },
) {
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function getSortValue(row: Integration, key: string): string {
    if (key === "description") return row.description?.toLowerCase() || "";
    return row.name?.toLowerCase() || "";
  }
  const sortedIntegrations = [...integrations].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const columns: TableColumn<Integration>[] = [
    {
      id: "name",
      header: "Name",
      render: (integration) => <IntegrationInfo integration={integration} />,
      sortable: true,
    },
    {
      id: "description",
      header: "Description",
      accessor: (integration) => integration.description,
      sortable: true,
      cellClassName: "max-w-md",
    },
    {
      id: "actions",
      header: "",
      render: (integration) => (
        <div onClick={(e) => e.stopPropagation()}>
          {!INTEGRATION_ID_DENYLIST.some((id) =>
            integration.id.startsWith(id)
          ) && <IntegrationActions onDelete={() => onDelete(integration.id)} />}
        </div>
      ),
    },
  ];

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  return (
    <Table
      columns={columns}
      data={sortedIntegrations}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      onRowClick={onConfigure}
    />
  );
}

function InstalledIntegrationsTab() {
  const [state, dispatch] = useReducer(listReducer, initialState);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const navigateWorkspace = useNavigateWorkspace();
  const { mutateAsync: removeIntegration } = useRemoveIntegration();
  const { filter, deleteDialogOpen, integrationToDelete, deleting } = state;

  const { data: installedIntegrations } = useIntegrations();

  const filteredIntegrations =
    installedIntegrations?.filter((integration) =>
      integration.name.toLowerCase().includes(filter.toLowerCase()) &&
      integration.connection.type !== "INNATE"
    ) ?? [];

  const handleConfigure = (integration: Integration) => {
    navigateWorkspace(`/integration/${integration.id}`);
  };

  const handleDeleteConfirm = (integrationId: string) => {
    dispatch({ type: "CONFIRM_DELETE", payload: integrationId });
  };

  const handleDelete = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    if (!integrationToDelete) return;

    try {
      dispatch({ type: "DELETE_START" });

      await removeIntegration(integrationToDelete);

      trackEvent("integration_delete", {
        ok: true,
        data: integrationToDelete,
      });
    } catch (error) {
      console.error("Error deleting integration:", error);

      trackEvent("integration_delete", {
        ok: false,
        data: integrationToDelete,
        error,
      });
    } finally {
      dispatch({ type: "DELETE_END" });
    }
  };

  const handleDeleteDialogOpenChange = (open: boolean) => {
    if (!open && !deleting) {
      dispatch({ type: "CANCEL_DELETE" });
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full py-4">
      <div className="px-4 overflow-x-auto">
        <Header
          value={filter}
          setValue={(value) => dispatch({ type: "SET_FILTER", payload: value })}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
      </div>

      <div className="flex-1 min-h-0 px-4 overflow-x-auto">
        {!installedIntegrations
          ? (
            <div className="flex h-48 items-center justify-center">
              <Spinner size="lg" />
            </div>
          )
          : installedIntegrations.length === 0
          ? (
            <EmptyState
              icon="conversion_path"
              title="No connected integrations yet"
              description="Connect services to expand what your agents can do."
              buttonProps={{
                children: "Connect an integration",
                onClick: () => navigateWorkspace("/integrations/marketplace"),
              }}
            />
          )
          : (
            viewMode === "cards"
              ? (
                <CardsView
                  integrations={filteredIntegrations}
                  onConfigure={handleConfigure}
                  onDelete={handleDeleteConfirm}
                />
              )
              : (
                <TableView
                  integrations={filteredIntegrations}
                  onConfigure={handleConfigure}
                  onDelete={handleDeleteConfirm}
                />
              )
          )}
      </div>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={handleDeleteDialogOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the integration. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {deleting
                ? (
                  <>
                    <Spinner />
                    Deleting...
                  </>
                )
                : (
                  "Delete"
                )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Page() {
  return (
    <IntegrationPageLayout
      tabs={{
        installed: {
          title: "Installed",
          Component: InstalledIntegrationsTab,
          initialOpen: true,
        },
      }}
    />
  );
}
