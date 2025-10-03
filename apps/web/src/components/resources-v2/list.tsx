import { callTool, useIntegration, useTools } from "@deco/sdk";
import type { ResourceItem } from "@deco/sdk/mcp";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { useViewMode } from "@deco/ui/hooks/use-view-mode.ts";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "react-router";
import { z } from "zod/v3";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { EmptyState } from "../common/empty-state.tsx";
import { ListPageHeader } from "../common/list-page-header.tsx";
import { Table, type TableColumn } from "../common/table/index.tsx";
import { TimeAgoCell, UserInfo } from "../common/table/table-cells.tsx";
import { useDecopilotThread } from "../decopilot/thread-context.tsx";
import {
  DecopilotLayout,
  useDecopilotOpen,
} from "../layout/decopilot-layout.tsx";
import { ResourceRouteProvider } from "./route-context.tsx";

// Base resource data schema that all resources extend
const BaseResourceDataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().url().optional(),
});

type ResourceListItem = ResourceItem<typeof BaseResourceDataSchema>;

function ResourcesV2ListTab({
  integrationId,
  resourceName,
  headerSlot,
}: {
  integrationId?: string;
  resourceName?: string;
  headerSlot?: ReactNode;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const integration = useIntegration(integrationId ?? "").data;
  const navigateWorkspace = useNavigateWorkspace();
  const [mutating, setMutating] = useState(false);
  const [viewMode, setViewMode] = useViewMode();
  const { setOpen: setDecopilotOpen } = useDecopilotOpen();
  const { setThreadState } = useDecopilotThread();

  const q = searchParams.get("q") ?? "";
  const deferredQ = useDeferredValue(q);

  const toolsQuery = useTools(integration!.connection!, false);
  const capabilities = useMemo(() => {
    const tools: Array<{ name: string }> = toolsQuery?.data?.tools ?? [];
    const has = (suffix: string) =>
      resourceName
        ? tools.some(
            (t) =>
              t.name ===
              `DECO_RESOURCE_${resourceName.toUpperCase()}_${suffix}`,
          )
        : false;
    return {
      hasCreate: has("CREATE"),
      hasUpdate: has("UPDATE"),
      hasDelete: has("DELETE"),
    };
  }, [toolsQuery?.data?.tools, resourceName]);

  const columns: TableColumn<ResourceListItem>[] = useMemo(
    () => [
      {
        id: "title",
        header: "Title",
        accessor: (row) => row.data?.name || "",
        cellClassName: "max-w-md",
        sortable: false,
      },
      {
        id: "description",
        header: "Description",
        accessor: (row) => row.data?.description || "",
        cellClassName: "max-w-2xl",
      },
      {
        id: "updated_at",
        header: "Updated",
        render: (row) => <TimeAgoCell value={row.updated_at} />, // falls back to "-" if undefined
        cellClassName: "whitespace-nowrap",
      },
      {
        id: "updated_by",
        header: "Updated by",
        render: (row) => <UserInfo userId={row.updated_by} noTooltip />, // avatar + short text
        cellClassName: "min-w-[160px]",
      },
      {
        id: "actions",
        header: "",
        render: (row) => (
          <div className="flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <Icon name="more_horiz" className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigateWorkspace(
                      `rsc/${integrationId}/${resourceName}/${encodeURIComponent(row.uri)}`,
                    );
                  }}
                >
                  Open
                </DropdownMenuItem>
                {capabilities.hasUpdate && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigateWorkspace(
                        `rsc/${integrationId}/${resourceName}/${encodeURIComponent(row.uri)}`,
                      );
                    }}
                  >
                    Edit
                  </DropdownMenuItem>
                )}
                {capabilities.hasDelete && (
                  <DropdownMenuItem
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!integration) return;
                      try {
                        setMutating(true);
                        await callTool(integration.connection, {
                          name: `DECO_RESOURCE_${(resourceName ?? "").toUpperCase()}_DELETE`,
                          arguments: { uri: row.uri },
                        });
                        await listQuery.refetch();
                      } finally {
                        setMutating(false);
                      }
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [integrationId, navigateWorkspace, resourceName, capabilities],
  );

  const listQuery = useQuery({
    queryKey: ["resources-v2-list", integrationId, resourceName, deferredQ],
    enabled: Boolean(integration && resourceName),
    queryFn: async () => {
      const result = (await callTool(integration!.connection, {
        name: `DECO_RESOURCE_${resourceName!.toUpperCase()}_SEARCH`,
        arguments: {
          term: deferredQ,
          page: 1,
          pageSize: 50,
        },
      })) as {
        structuredContent?: {
          items?: Array<ResourceListItem>;
        };
      };
      return result?.structuredContent?.items ?? [];
    },
  });

  const items = listQuery.data ?? [];
  const loading = listQuery.isLoading || listQuery.isFetching || mutating;
  const error = listQuery.isError ? (listQuery.error as Error).message : null;

  // Removed effects in favor of TanStack Query hooks

  if (!integrationId || !resourceName) {
    return (
      <EmptyState
        icon="report"
        title="Missing parameters"
        description="integrationId or resourceName not provided."
      />
    );
  }

  return (
    <div className="p-4 space-y-3 h-full">
      {headerSlot}
      <ListPageHeader
        input={{
          placeholder: `Search ${resourceName}...`,
          value: q,
          onChange: (e) =>
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              const v = (e.target as HTMLInputElement).value;
              if (v) next.set("q", v);
              else next.delete("q");
              return next;
            }),
          onKeyDown: (e) => {
            if (e.key === "Enter") {
              listQuery.refetch();
            }
          },
        }}
        view={{ viewMode, onChange: setViewMode }}
        controlsAlign="start"
        actionsRight={
          <div className="pl-3 ml-2 border-l border-border flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => listQuery.refetch()}
                    variant="outline"
                    size="icon"
                    disabled={loading}
                  >
                    <Icon name="refresh" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {capabilities.hasCreate ? (
              <Button
                onClick={() => {
                  setDecopilotOpen(true);
                  setThreadState({
                    threadId: crypto.randomUUID(),
                    initialMessage: `Please help me create a new ${resourceName || "item"}`,
                    autoSend: true,
                  });
                }}
                variant="special"
              >
                <Icon name="add" />
                Create
              </Button>
            ) : null}
          </div>
        }
      />

      {error && (
        <Card>
          <CardContent className="p-4 text-destructive text-sm">
            {error}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-full py-8">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="list"
          title="No resources found"
          description={`No ${resourceName} found for this integration.`}
        />
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((it) => (
            <Card key={it.uri} className="cursor-pointer group relative">
              <CardContent
                className="p-3 flex flex-col gap-2"
                onClick={() =>
                  navigateWorkspace(
                    `rsc/${integrationId}/${resourceName}/${encodeURIComponent(it.uri)}`,
                  )
                }
              >
                <div className="flex items-start gap-3">
                  {it.data?.icon && (
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                      <img
                        src={it.data.icon}
                        alt={it.data?.name || ""}
                        className="w-8 h-8 rounded object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {it.data?.name ?? ""}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {it.data?.description ?? ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline">Updated</span>
                    <TimeAgoCell value={it.updated_at} />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>by</span>
                    <UserInfo userId={it.updated_by} nameOnly />
                  </div>
                </div>
                <div
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Icon name="more_horiz" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onClick={() =>
                          navigateWorkspace(
                            `rsc/${integrationId}/${resourceName}/${encodeURIComponent(it.uri)}`,
                          )
                        }
                      >
                        Open
                      </DropdownMenuItem>
                      {capabilities.hasUpdate ? (
                        <DropdownMenuItem
                          onClick={() =>
                            navigateWorkspace(
                              `rsc/${integrationId}/${resourceName}/${encodeURIComponent(it.uri)}`,
                            )
                          }
                        >
                          Edit
                        </DropdownMenuItem>
                      ) : null}
                      {capabilities.hasDelete ? (
                        <DropdownMenuItem
                          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                          onClick={async () => {
                            if (!integration) return;
                            try {
                              setMutating(true);
                              await callTool(integration.connection, {
                                name: `DECO_RESOURCE_${(resourceName ?? "").toUpperCase()}_DELETE`,
                                arguments: { uri: it.uri },
                              });
                              await listQuery.refetch();
                            } finally {
                              setMutating(false);
                            }
                          }}
                        >
                          Delete
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Table
          columns={columns}
          data={items}
          onRowClick={(row) =>
            navigateWorkspace(
              `rsc/${integrationId}/${resourceName}/${encodeURIComponent(row.uri)}`,
            )
          }
        />
      )}
    </div>
  );
}

export function ResourcesV2List({
  integrationId,
  resourceName,
  headerSlot,
}: {
  integrationId?: string;
  resourceName?: string;
  headerSlot?: ReactNode;
}) {
  const integration = useIntegration(integrationId ?? "").data;

  // Fetch tools for the integration
  const toolsQuery = useTools(integration!.connection, false);
  const tools = toolsQuery?.data?.tools ?? [];

  // Prepare decopilot context value for resource list
  const decopilotContextValue = useMemo(() => {
    if (!integrationId) return {};

    const rules: string[] = [
      `You are helping with ${resourceName || "resource"} management. Focus on operations related to listing, creating, and managing ${resourceName || "resources"}.`,
      `When working with ${resourceName || "resources"}, prioritize operations that help users understand, organize, and manage their ${resourceName || "resource"} data effectively.`,
    ];

    return {
      additionalTools:
        tools.length > 0
          ? {
              [integrationId]: tools.map((tool) => tool.name),
            }
          : undefined,
      rules,
    };
  }, [integrationId, resourceName, tools]);

  return (
    <DecopilotLayout value={decopilotContextValue}>
      <ResourceRouteProvider
        integrationId={integrationId}
        resourceName={resourceName}
      >
        <ResourcesV2ListTab
          integrationId={integrationId}
          resourceName={resourceName}
          headerSlot={headerSlot}
        />
      </ResourceRouteProvider>
    </DecopilotLayout>
  );
}

/** Component to connect route params to the component */
export default function ResourcesV2ListPage() {
  const { integrationId, resourceName } = useParams();

  return (
    <ResourcesV2List
      integrationId={integrationId}
      resourceName={resourceName}
    />
  );
}
