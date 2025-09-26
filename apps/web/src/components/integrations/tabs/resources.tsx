import { type Integration, useTools, useAddResource, useRemoveResource, buildAddResourcePayload } from "@deco/sdk";
import { Card } from "@deco/ui/components/card.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { useMemo, useState } from "react";
import { useNavigateWorkspace } from "../../../hooks/use-navigate-workspace.ts";
import { useCurrentTeam } from "../../sidebar/team-selector.tsx";

function ResourceTypePill({ label }: { label: string }) {
  return (
    <div className="px-2 py-1 rounded-md text-xs bg-muted text-muted-foreground border border-border">{label}</div>
  );
}

export function ResourcesV2UI({ integration }: { integration: Integration }) {
  const connection = integration.connection;
  const { data: toolsData } = useTools(connection);
  const navigateWorkspace = useNavigateWorkspace();
  const currentTeam = useCurrentTeam();
  const addResourceMutation = useAddResource();
  const removeResourceMutation = useRemoveResource();

  const [term, setTerm] = useState("");

  interface ResourceTypeInfo {
    typeName: string;
    searchDesc?: string;
    readDesc?: string;
    hasSearch: boolean;
    hasRead: boolean;
    hasCreate: boolean;
    hasUpdate: boolean;
    hasDelete: boolean;
  }

  const resourceTypes: ResourceTypeInfo[] = useMemo(() => {
    const searchMatcher = /^DECO_RESOURCE_([A-Z0-9_]+)_SEARCH$/;
    const readMatcher = /^DECO_RESOURCE_([A-Z0-9_]+)_READ$/;
    const createMatcher = /^DECO_RESOURCE_([A-Z0-9_]+)_CREATE$/;
    const updateMatcher = /^DECO_RESOURCE_([A-Z0-9_]+)_UPDATE$/;
    const deleteMatcher = /^DECO_RESOURCE_([A-Z0-9_]+)_DELETE$/;
    const types = new Map<string, ResourceTypeInfo>();
    for (const t of toolsData.tools) {
      const mSearch = t.name.match(searchMatcher);
      if (mSearch) {
        const key = mSearch[1];
        const prev = types.get(key) || {
          typeName: key,
          hasSearch: false,
          hasRead: false,
          hasCreate: false,
          hasUpdate: false,
          hasDelete: false,
        };
        types.set(key, { ...prev, searchDesc: t.description, hasSearch: true });
      }
      const mRead = t.name.match(readMatcher);
      if (mRead) {
        const key = mRead[1];
        const prev = types.get(key) || {
          typeName: key,
          hasSearch: false,
          hasRead: false,
          hasCreate: false,
          hasUpdate: false,
          hasDelete: false,
        };
        types.set(key, { ...prev, readDesc: t.description, hasRead: true });
      }
      const mCreate = t.name.match(createMatcher);
      if (mCreate) {
        const key = mCreate[1];
        const prev = types.get(key) || {
          typeName: key,
          hasSearch: false,
          hasRead: false,
          hasCreate: false,
          hasUpdate: false,
          hasDelete: false,
        };
        types.set(key, { ...prev, hasCreate: true });
      }
      const mUpdate = t.name.match(updateMatcher);
      if (mUpdate) {
        const key = mUpdate[1];
        const prev = types.get(key) || {
          typeName: key,
          hasSearch: false,
          hasRead: false,
          hasCreate: false,
          hasUpdate: false,
          hasDelete: false,
        };
        types.set(key, { ...prev, hasUpdate: true });
      }
      const mDelete = t.name.match(deleteMatcher);
      if (mDelete) {
        const key = mDelete[1];
        const prev = types.get(key) || {
          typeName: key,
          hasSearch: false,
          hasRead: false,
          hasCreate: false,
          hasUpdate: false,
          hasDelete: false,
        };
        types.set(key, { ...prev, hasDelete: true });
      }
    }
    return Array.from(types.values()).sort((a, b) => a.typeName.localeCompare(b.typeName));
  }, [toolsData.tools]);

  const filtered = useMemo(() => {
    const q = term.toLowerCase();
    if (!q) return resourceTypes;
    return resourceTypes.filter(
      (i) =>
        i.typeName.toLowerCase().includes(q) ||
        (i.searchDesc || "").toLowerCase().includes(q) ||
        (i.readDesc || "").toLowerCase().includes(q),
    );
  }, [term, resourceTypes]);

  // Check which resources are already added to the team
  const resourcesWithStatus = useMemo(() => {
    if (!resourceTypes || resourceTypes.length === 0 || !currentTeam.resources) return [];
    return resourceTypes.map((resource) => {
      const existingResource = currentTeam.resources.find(
        (r) => r.integration_id === integration.id && r.name === resource.typeName.toLowerCase()
      );
      return {
        ...resource,
        isAdded: !!existingResource,
        teamResourceId: existingResource?.id,
      } as typeof resource & { isAdded: boolean; teamResourceId?: string };
    });
  }, [resourceTypes, currentTeam.resources, integration.id]);

  const handleAddResource = async (resource: (typeof resourceTypes)[0]) => {
    try {
      await addResourceMutation.mutateAsync({
        resource: buildAddResourcePayload({
          resource: {
            name: resource.typeName.toLowerCase(),
            title: resource.typeName,
            icon: "folder", // Default icon for resources
            resourceType: resource.typeName.toLowerCase(),
          },
          integrationId: integration.id,
        }),
      });
      toast.success(`Resource "${resource.typeName}" added successfully`);
    } catch (error) {
      console.error("Error adding resource:", error);
      toast.error(`Failed to add resource "${resource.typeName}"`);
    }
  };

  const handleRemoveResource = async (resourceWithStatus: (typeof resourcesWithStatus)[0]) => {
    if (!resourceWithStatus.teamResourceId) {
      toast.error("No resource to remove");
      return;
    }
    try {
      await removeResourceMutation.mutateAsync({ resourceId: resourceWithStatus.teamResourceId });
      toast.success(`Resource "${resourceWithStatus.typeName}" removed successfully`);
    } catch (error) {
      console.error("Error removing resource:", error);
      toast.error(`Failed to remove resource "${resourceWithStatus.typeName}"`);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2">
        <Input placeholder="Search resource types..." value={term} onChange={(e) => setTerm(e.target.value)} className="max-w-md" />
      </div>
      <ScrollArea className="flex-1 h-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4">
          {resourcesWithStatus.length === 0
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
            : resourcesWithStatus.map((item) => (
                <Card key={item.typeName} className="p-4 rounded-xl border-border">
                  <div className="flex flex-col justify-between gap-3 w-full h-full">
                    <div className="text-sm font-semibold">{item.typeName}</div>
                    {(item.searchDesc || item.readDesc) && (
                      <div className="text-sm text-muted-foreground line-clamp-2 flex-1">{item.searchDesc || item.readDesc}</div>
                    )}
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      {item.hasSearch && <ResourceTypePill label="search" />}
                      {item.hasRead && <ResourceTypePill label="read" />}
                      {item.hasCreate && <ResourceTypePill label="create" />}
                      {item.hasUpdate && <ResourceTypePill label="update" />}
                      {item.hasDelete && <ResourceTypePill label="delete" />}
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      {item.isAdded && (
                        <div className="flex items-center gap-1 text-xs text-success">
                          <Icon name="check_circle" size={14} />
                          <span>Added</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        {item.isAdded ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleRemoveResource(item)}
                            disabled={removeResourceMutation.isPending}
                          >
                            {removeResourceMutation.isPending ? (
                              <Icon name="hourglass_empty" size={14} />
                            ) : (
                              <Icon name="remove" size={14} />
                            )}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddResource(item)}
                            disabled={addResourceMutation.isPending}
                          >
                            {addResourceMutation.isPending ? (
                              <Icon name="hourglass_empty" size={14} />
                            ) : (
                              <Icon name="add" size={14} />
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigateWorkspace(`rsc/${integration.id}/${item.typeName.toLowerCase()}`)}
                          title="Open list"
                        >
                          <Icon name="open_in_new" className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
        </div>
      </ScrollArea>
    </div>
  );
}


