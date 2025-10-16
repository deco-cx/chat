import {
  callTool,
  useIntegration,
  useTools,
  AI_APP_PRD_TEMPLATE,
} from "@deco/sdk";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { useViewMode } from "@deco/ui/hooks/use-view-mode.ts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "react-router";
import { z } from "zod";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { formatResourceName } from "../../utils/format.ts";
import { usePersistedFilters } from "../../hooks/use-persisted-filters.ts";
import { useSortable } from "../../hooks/use-sortable.ts";
import { EmptyState } from "../common/empty-state.tsx";
import { Table, type TableColumn } from "../common/table/index.tsx";
import { TimeAgoCell, UserInfo } from "../common/table/table-cells.tsx";
import type { TabItem } from "./resource-header.tsx";
import { DecopilotLayout } from "../layout/decopilot-layout.tsx";
import { ResourceHeader } from "./resource-header.tsx";
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
  tabs,
  activeTab,
  onTabChange,
}: {
  integrationId?: string;
  resourceName?: string;
  headerSlot?: ReactNode;
  tabs?: TabItem[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const integration = useIntegration(integrationId ?? "").data;
  const navigateWorkspace = useNavigateWorkspace();
  const queryClient = useQueryClient();
  const [mutating, setMutating] = useState(false);
  const [viewMode, setViewMode] = useViewMode();
  const [deleteUri, setDeleteUri] = useState<string | null>(null);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { sortKey, sortDirection, handleSort } = useSortable("updated_at");

  // Session storage key for skip confirmation preference
  const skipConfirmationKey = `skip-delete-confirmation-${integrationId}-${resourceName}`;

  // Check if user has set "don't ask again" in this session
  const shouldSkipConfirmation = () => {
    return sessionStorage.getItem(skipConfirmationKey) === "true";
  };

  // Use persisted filters with a unique key based on integration and resource
  const filterKey = `${integrationId}-${resourceName}`;
  const [filters, setFilters] = usePersistedFilters(filterKey);

  // Persist filter bar visibility
  const filterBarVisibilityKey = `deco-filter-bar-visible-${filterKey}`;
  const [filterBarVisible, setFilterBarVisible] = useState(() => {
    const stored = globalThis.localStorage?.getItem(filterBarVisibilityKey);
    return stored === "true";
  });

  const q = searchParams.get("q") ?? "";
  const deferredQ = useDeferredValue(q);

  const connection = integration?.connection;
  const toolsQuery = useTools(connection!, false);
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
        header: "Name",
        accessor: (row) => row.data?.name || "",
        cellClassName: "max-w-3xs font-medium",
        sortable: true,
      },
      {
        id: "description",
        header: "Description",
        accessor: (row) => row.data?.description || "",
        cellClassName: "max-w-xl",
        sortable: true,
      },
      {
        id: "updated_at",
        header: "Updated",
        render: (row) => <TimeAgoCell value={row.updated_at} />,
        cellClassName: "whitespace-nowrap min-w-30",
        sortable: true,
      },
      {
        id: "updated_by",
        header: "Updated by",
        render: (row) => (
          <UserInfo userId={row.updated_by} showEmail={false} size="sm" />
        ),
        cellClassName: "max-w-3xs",
        sortable: true,
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
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="text-muted-foreground"
                >
                  <Icon name="more_horiz" className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateWorkspace(
                      `rsc/${integrationId}/${resourceName}/${encodeURIComponent(row.uri)}`,
                    );
                  }}
                >
                  <Icon name="open_in_new" className="w-4 h-4 mr-2" />
                  Open
                </DropdownMenuItem>
                {capabilities.hasDelete && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteClick(row.uri);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Icon name="delete" className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
        cellClassName: "w-[5%]",
      },
    ],
    [capabilities.hasDelete, navigateWorkspace, integrationId, resourceName],
  );

  const listQuery = useQuery({
    queryKey: ["resources-v2-list", integrationId, resourceName, deferredQ],
    enabled: Boolean(integration && resourceName),
    staleTime: 0, // Always consider data stale so it refetches when invalidated
    refetchOnMount: "always", // Always refetch when component mounts
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

  // Get unique users from the items for filter dropdown
  const availableUsers = useMemo(() => {
    const userIds = new Set<string>();
    items.forEach((item) => {
      if (item.created_by) userIds.add(item.created_by);
      if (item.updated_by) userIds.add(item.updated_by);
    });
    return Array.from(userIds).map((id) => ({ id, name: id }));
  }, [items]);

  // Apply filters to items
  const filteredItems = useMemo(() => {
    if (filters.length === 0) return items;

    return items.filter((item) => {
      return filters.every((filter) => {
        const { column, operator, value } = filter;

        // Text filters (name, description)
        if (column === "name" || column === "description") {
          const fieldValue = (item.data?.[column] || "").toLowerCase();
          const filterValue = (value || "").toLowerCase();

          switch (operator) {
            case "contains":
              return fieldValue.includes(filterValue);
            case "does_not_contain":
              return !fieldValue.includes(filterValue);
            case "is":
              return fieldValue === filterValue;
            case "is_not":
              return fieldValue !== filterValue;
            default:
              return true;
          }
        }

        // User filters (created_by, updated_by)
        if (column === "created_by" || column === "updated_by") {
          const fieldValue = item[column];
          return fieldValue === value;
        }

        // Date filters (created_at, updated_at)
        if (column === "created_at" || column === "updated_at") {
          const fieldValue = item[column];
          if (!fieldValue) return false;

          const itemDate = new Date(fieldValue);
          const now = new Date();

          if (operator === "in_last") {
            let daysAgo = 0;
            switch (value) {
              case "7d":
                daysAgo = 7;
                break;
              case "30d":
                daysAgo = 30;
                break;
              case "3m":
                daysAgo = 90;
                break;
              case "all":
                return true;
              default:
                return true;
            }
            const cutoff = new Date(
              now.getTime() - daysAgo * 24 * 60 * 60 * 1000,
            );
            return itemDate >= cutoff;
          }
        }

        return true;
      });
    });
  }, [items, filters]);

  // Sort the items based on current sort state
  const sortedItems = useMemo(() => {
    if (!sortKey || !sortDirection) return filteredItems;

    return [...filteredItems].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      // Get values based on column
      switch (sortKey) {
        case "title":
          aValue = (a.data?.name || "").toLowerCase();
          bValue = (b.data?.name || "").toLowerCase();
          break;
        case "description":
          aValue = (a.data?.description || "").toLowerCase();
          bValue = (b.data?.description || "").toLowerCase();
          break;
        case "updated_at":
          aValue = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          bValue = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          break;
        case "updated_by":
          aValue = (a.updated_by || "").toLowerCase();
          bValue = (b.updated_by || "").toLowerCase();
          break;
        default:
          return 0;
      }

      // Compare values
      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortKey, sortDirection]);

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

  // Format resource name for title (e.g., "WORKFLOW_RUN" -> "Workflow Runs")
  const title = useMemo(() => {
    return resourceName ? formatResourceName(resourceName) : "Resources";
  }, [resourceName]);

  // Always ensure there's at least an "All" tab
  const finalTabs = useMemo(() => {
    if (!tabs || tabs.length === 0) {
      return [{ id: "all", label: "All" }];
    }
    return tabs;
  }, [tabs]);

  return (
    <div className="h-full p-0 overflow-y-auto">
      <div className="py-4 px-4 md:py-8 md:px-8 lg:py-16 lg:px-16 space-y-4 md:space-y-6 lg:space-y-8">
        <div className="max-w-[1500px] mx-auto w-full space-y-4 md:space-y-6 lg:space-y-8">
          {headerSlot}
          <ResourceHeader
            title={title}
            tabs={finalTabs}
            activeTab={activeTab || "all"}
            onTabChange={onTabChange}
            searchOpen={searchOpen}
            searchValue={q}
            onSearchToggle={() => setSearchOpen(!searchOpen)}
            onSearchChange={(value: string) => {
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                if (value) next.set("q", value);
                else next.delete("q");
                return next;
              });
            }}
            onSearchBlur={() => {
              if (!q) {
                setSearchOpen(false);
              }
            }}
            onSearchKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") {
                listQuery.refetch();
              }
              if (e.key === "Escape") {
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete("q");
                  return next;
                });
                setSearchOpen(false);
                (e.target as HTMLInputElement).blur();
              }
            }}
            onRefresh={() => listQuery.refetch()}
            onFilterClick={() => {
              const newValue = !filterBarVisible;
              setFilterBarVisible(newValue);
              globalThis.localStorage?.setItem(
                filterBarVisibilityKey,
                String(newValue),
              );
            }}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            filterBarVisible={filterBarVisible}
            filters={filters}
            onFiltersChange={setFilters}
            availableUsers={availableUsers}
            ctaButton={
              capabilities.hasCreate ? (
                resourceName === "document" ? (
                  // Split button for documents with dropdown options
                  <div className="w-full md:w-auto flex items-stretch rounded-xl overflow-hidden">
                    <Button
                      onClick={async () => {
                        if (!integration) return;
                        try {
                          setMutating(true);

                          const timestamp = new Date()
                            .toISOString()
                            .replace(/[:.]/g, "-");
                          const data = {
                            name: `Untitled-${timestamp}`,
                            description: "",
                            content: "",
                          };

                          const result = await callTool(
                            integration.connection,
                            {
                              name: "DECO_RESOURCE_DOCUMENT_CREATE",
                              arguments: { data },
                            },
                          );

                          const uri =
                            (result as { uri?: string })?.uri ||
                            (result as { data?: { uri?: string } })?.data
                              ?.uri ||
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
                            throw new Error(
                              "No URI returned from create operation",
                            );
                          }

                          queryClient.invalidateQueries({
                            queryKey: [
                              "resources-v2-list",
                              integrationId,
                              resourceName,
                            ],
                          });

                          navigateWorkspace(
                            `rsc/${integrationId}/${resourceName}/${encodeURIComponent(uri)}`,
                          );
                        } catch (error) {
                          console.error("Failed to create document:", error);
                          toast.error(
                            "Failed to create document. Please try again.",
                          );
                          setMutating(false);
                        }
                      }}
                      variant="special"
                      className="flex-1 h-9 rounded-none rounded-l-xl"
                      disabled={mutating}
                    >
                      {mutating ? (
                        <div className="w-4 h-4">
                          <Spinner />
                        </div>
                      ) : (
                        <Icon name="add" />
                      )}
                      New document
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="special"
                          size="icon"
                          className="h-9 w-10 rounded-none rounded-r-xl border-l border-white/20"
                          disabled={mutating}
                        >
                          <Icon name="expand_more" size={20} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onSelect={async () => {
                            if (!integration) return;
                            try {
                              setMutating(true);

                              const timestamp = new Date()
                                .toISOString()
                                .replace(/[:.]/g, "-");
                              const data = {
                                name: `Untitled-${timestamp}`,
                                description: "",
                                content: "",
                              };

                              const result = await callTool(
                                integration.connection,
                                {
                                  name: "DECO_RESOURCE_DOCUMENT_CREATE",
                                  arguments: { data },
                                },
                              );

                              const uri =
                                (result as { uri?: string })?.uri ||
                                (result as { data?: { uri?: string } })?.data
                                  ?.uri ||
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
                                throw new Error(
                                  "No URI returned from create operation",
                                );
                              }

                              queryClient.invalidateQueries({
                                queryKey: [
                                  "resources-v2-list",
                                  integrationId,
                                  resourceName,
                                ],
                              });

                              navigateWorkspace(
                                `rsc/${integrationId}/${resourceName}/${encodeURIComponent(uri)}`,
                              );
                            } catch (error) {
                              console.error(
                                "Failed to create document:",
                                error,
                              );
                              toast.error(
                                "Failed to create document. Please try again.",
                              );
                              setMutating(false);
                            }
                          }}
                        >
                          <Icon name="docs" size={18} className="mr-2" />
                          <div className="flex-1">
                            <div className="font-medium">Blank Document</div>
                            <div className="text-xs text-muted-foreground">
                              Start from scratch
                            </div>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onSelect={async () => {
                            if (!integration) return;
                            try {
                              setMutating(true);

                              const timestamp = new Date()
                                .toISOString()
                                .replace(/[:.]/g, "-");
                              const data = {
                                name: `AI App PRD - ${timestamp}`,
                                description:
                                  "Product Requirements Document for an AI-native application on decocms.com platform. This document helps plan tools, agents, workflows, views, and databases.",
                                content: AI_APP_PRD_TEMPLATE,
                              };

                              const result = await callTool(
                                integration.connection,
                                {
                                  name: "DECO_RESOURCE_DOCUMENT_CREATE",
                                  arguments: { data },
                                },
                              );

                              const uri =
                                (result as { uri?: string })?.uri ||
                                (result as { data?: { uri?: string } })?.data
                                  ?.uri ||
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
                                throw new Error(
                                  "No URI returned from create operation",
                                );
                              }

                              queryClient.invalidateQueries({
                                queryKey: [
                                  "resources-v2-list",
                                  integrationId,
                                  resourceName,
                                ],
                              });

                              navigateWorkspace(
                                `rsc/${integrationId}/${resourceName}/${encodeURIComponent(uri)}`,
                              );
                            } catch (error) {
                              console.error(
                                "Failed to create PRD document:",
                                error,
                              );
                              toast.error(
                                "Failed to create PRD document. Please try again.",
                              );
                              setMutating(false);
                            }
                          }}
                        >
                          <Icon
                            name="rocket_launch"
                            size={18}
                            className="mr-2"
                          />
                          <div className="flex-1">
                            <div className="font-medium">AI App PRD</div>
                            <div className="text-xs text-muted-foreground">
                              Plan tools, agents & workflows
                            </div>
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : (
                  // Regular button for other resources
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
                      } else if (resourceName === "workflow") {
                        data.inputSchema = {};
                        data.outputSchema = {};
                        data.steps = [];
                        data.triggers = [];
                      } else if (resourceName === "tool") {
                        data.inputSchema = {};
                        data.outputSchema = {};
                        data.execute =
                          "// Add your tool code here\nexport default function(input) {\n  return {};\n}";
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
                          throw new Error(
                            "No URI returned from create operation",
                          );
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
                    className="h-9 rounded-xl w-full md:w-auto"
                    disabled={mutating}
                  >
                    {mutating ? (
                      <div className="w-4 h-4">
                        <Spinner />
                      </div>
                    ) : (
                      <Icon name="add" />
                    )}
                    New {resourceName}
                  </Button>
                )
              ) : undefined
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
          ) : sortedItems.length === 0 ? (
            <EmptyState
              icon="list"
              title="No resources found"
              description={`No ${resourceName} found for this integration.`}
            />
          ) : viewMode === "cards" ? (
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              }}
            >
              {sortedItems.map((it) => (
                <Card
                  key={it.uri}
                  className="group cursor-pointer hover:shadow-sm transition-shadow overflow-hidden bg-card border-0 min-h-48"
                  onClick={() =>
                    navigateWorkspace(
                      `rsc/${integrationId}/${resourceName}/${encodeURIComponent(it.uri)}`,
                    )
                  }
                >
                  <div className="flex flex-col h-full">
                    {/* Content Section */}
                    <div className="p-5 flex flex-col gap-2 flex-1 relative">
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              className="text-muted-foreground h-8 w-8"
                            >
                              <Icon name="more_horiz" className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                navigateWorkspace(
                                  `rsc/${integrationId}/${resourceName}/${encodeURIComponent(it.uri)}`,
                                );
                              }}
                            >
                              <Icon
                                name="open_in_new"
                                className="w-4 h-4 mr-2"
                              />
                              Open
                            </DropdownMenuItem>
                            {capabilities.hasDelete && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteClick(it.uri);
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Icon name="delete" className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <h3 className="text-base font-medium text-foreground truncate pr-10">
                        {it.data?.name ?? ""}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-normal">
                        {it.data?.description ?? ""}
                      </p>
                    </div>

                    {/* Footer Section */}
                    <div className="border-t border-border px-5 py-3 flex items-center justify-between text-sm flex-shrink-0 flex-wrap gap-x-4 gap-y-1">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Updated</span>
                        <span className="text-foreground">
                          <TimeAgoCell value={it.updated_at} />
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">by</span>
                        <UserInfo
                          userId={it.updated_by}
                          size="xs"
                          showEmail={false}
                          noTooltip
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : null}
          {viewMode === "table" && !loading && sortedItems.length > 0 && (
            <div className="overflow-x-auto -mx-16 px-16">
              <div className="w-fit min-w-full max-w-[1500px] mx-auto">
                <Table
                  columns={columns}
                  data={sortedItems}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  onRowClick={(row) =>
                    navigateWorkspace(
                      `rsc/${integrationId}/${resourceName}/${encodeURIComponent(row.uri)}`,
                    )
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>

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
  tabs,
  activeTab,
  onTabChange,
}: {
  integrationId?: string;
  resourceName?: string;
  headerSlot?: ReactNode;
  tabs?: TabItem[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}) {
  const integration = useIntegration(integrationId ?? "").data;

  // Fetch tools for the integration
  const connection = integration?.connection;
  const toolsQuery = useTools(connection!, false);
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
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
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
