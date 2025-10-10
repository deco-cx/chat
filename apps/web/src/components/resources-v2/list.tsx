import { callTool, useIntegration, useTools } from "@deco/sdk";
import type { ResourceItem } from "@deco/sdk/mcp";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
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
import { Checkbox } from "@deco/ui/components/checkbox.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { useViewMode } from "@deco/ui/hooks/use-view-mode.ts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "react-router";
import { z } from "zod";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { EmptyState } from "../common/empty-state.tsx";
import { ListPageHeader } from "../common/list-page-header.tsx";
import { Table, type TableColumn } from "../common/table/index.tsx";
import { TimeAgoCell, UserInfo } from "../common/table/table-cells.tsx";
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
  const queryClient = useQueryClient();
  const [mutating, setMutating] = useState(false);
  const [viewMode, setViewMode] = useViewMode();
  const [deleteUri, setDeleteUri] = useState<string | null>(null);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  // Session storage key for skip confirmation preference
  const skipConfirmationKey = `skip-delete-confirmation-${integrationId}-${resourceName}`;

  // Check if user has set "don't ask again" in this session
  const shouldSkipConfirmation = () => {
    return sessionStorage.getItem(skipConfirmationKey) === "true";
  };

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
        render: (row) => (
          <div className="truncate" style={{ maxWidth: "200px" }}>
            {row.data?.name || ""}
          </div>
        ),
        sortable: false,
        cellClassName: "w-[20%]",
      },
      {
        id: "description",
        header: "Description",
        render: (row) => (
          <div className="truncate" style={{ maxWidth: "300px" }}>
            {row.data?.description || ""}
          </div>
        ),
        cellClassName: "w-[40%]",
      },
      {
        id: "updated_at",
        header: "Updated",
        render: (row) => <TimeAgoCell value={row.updated_at} />,
        cellClassName: "whitespace-nowrap w-[15%]",
      },
      {
        id: "updated_by",
        header: "Updated by",
        render: (row) => <UserInfo userId={row.updated_by} noTooltip />,
        cellClassName: "w-[20%]",
      },
      {
        id: "actions",
        header: "",
        render: (row) =>
          capabilities.hasDelete ? (
            <div className="flex items-center justify-end">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteClick(row.uri);
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Icon name="delete" className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : null,
        cellClassName: "w-[5%]",
      },
    ],
    [capabilities.hasDelete],
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
  // Only show loading spinner on initial load, not during mutations or background refetches
  // Mutations show loading on the button itself, not full-page
  const loading = listQuery.isLoading;
  const error = listQuery.isError ? (listQuery.error as Error).message : null;

  // Delete handler
  const handleDelete = async (uri: string) => {
    if (!integration) return;
    try {
      setMutating(true);
      await callTool(integration.connection, {
        name: `DECO_RESOURCE_${(resourceName ?? "").toUpperCase()}_DELETE`,
        arguments: { uri },
      });
      toast.success(`${resourceName || "Resource"} deleted successfully`);
      await listQuery.refetch();
    } catch (error) {
      console.error(`Failed to delete ${resourceName}:`, error);
      toast.error(`Failed to delete ${resourceName}. Please try again.`);
    } finally {
      setMutating(false);
    }
  };

  // Handle delete button click
  const onDeleteClick = (uri: string) => {
    if (shouldSkipConfirmation()) {
      handleDelete(uri);
    } else {
      setDeleteUri(uri);
    }
  };

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
                    disabled={listQuery.isFetching}
                  >
                    <Icon
                      name="refresh"
                      className={listQuery.isFetching ? "animate-spin" : ""}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {capabilities.hasCreate ? (
              <Button
                onClick={async () => {
                  if (!integration) return;
                  try {
                    setMutating(true);

                    // Generate unique name with timestamp
                    const timestamp = new Date()
                      .toISOString()
                      .replace(/[:.]/g, "-");
                    const uniqueName = `Untitled-${timestamp}`;

                    // Build data payload based on resource type
                    const data: Record<string, unknown> = {
                      name: uniqueName,
                      description: "",
                    };

                    // Add resource-specific required fields
                    if (resourceName === "document") {
                      data.content = "";
                    }

                    const result = await callTool(integration.connection, {
                      name: `DECO_RESOURCE_${(resourceName ?? "").toUpperCase()}_CREATE`,
                      arguments: { data },
                    });

                    // Extract URI from response (can be at different levels)
                    const uri =
                      (result as { uri?: string })?.uri ||
                      (result as { data?: { uri?: string } })?.data?.uri ||
                      (
                        result as {
                          structuredContent?: { uri?: string };
                        }
                      )?.structuredContent?.uri ||
                      (
                        result as {
                          content?: Array<{ text?: string }>;
                        }
                      )?.content?.[0]?.text;

                    if (!uri) {
                      console.error("Create result:", result);
                      throw new Error("No URI returned from create operation");
                    }

                    // Invalidate list query so it refreshes when user navigates back
                    queryClient.invalidateQueries({
                      queryKey: [
                        "resources-v2-list",
                        integrationId,
                        resourceName,
                      ],
                    });

                    // Navigate immediately - the route change will unmount this component
                    navigateWorkspace(
                      `rsc/${integrationId}/${resourceName}/${encodeURIComponent(uri)}`,
                    );
                  } catch (error) {
                    console.error(
                      `Failed to create ${resourceName || "resource"}:`,
                      error,
                    );
                    toast.error(
                      `Failed to create ${resourceName || "resource"}. Please try again.`,
                    );
                    setMutating(false);
                  }
                }}
                variant="special"
                disabled={mutating}
              >
                {mutating ? (
                  <div className="w-4 h-4">
                    <Spinner />
                  </div>
                ) : (
                  <Icon name="add" />
                )}
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
                {capabilities.hasDelete && (
                  <div
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDeleteClick(it.uri)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Icon name="delete" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteUri}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteUri(null);
            setDontAskAgain(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {resourceName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this{" "}
              {resourceName || "resource"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center space-x-2 px-6 py-2">
            <Checkbox
              id="dont-ask-again"
              checked={dontAskAgain}
              onCheckedChange={(checked) => setDontAskAgain(checked === true)}
            />
            <label
              htmlFor="dont-ask-again"
              className="text-sm text-muted-foreground cursor-pointer select-none"
            >
              Don't ask again for this session
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteUri) return;

                const uriToDelete = deleteUri;

                // Save preference to sessionStorage (persists across navigations)
                if (dontAskAgain) {
                  sessionStorage.setItem(skipConfirmationKey, "true");
                }

                // Close modal
                setDeleteUri(null);
                setDontAskAgain(false);

                // Perform delete after state updates
                setTimeout(() => {
                  handleDelete(uriToDelete);
                }, 0);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
