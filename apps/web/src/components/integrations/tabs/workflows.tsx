import { type Integration, useTools } from "@deco/sdk";
import { Card } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { useMemo, useState } from "react";

interface SearchResultItem {
  uri: string;
  data?: { name?: string; description?: string } & Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export function WorkflowsV2UI({ integration }: { integration: Integration }) {
  const connection = integration.connection;
  const { data: toolsData, isLoading: isLoadingTools } = useTools(connection);
  const [term, setTerm] = useState("");

  const hasSearchTool = useMemo(
    () => toolsData.tools.some((t) => t.name === "DECO_RESOURCE_WORKFLOW_SEARCH"),
    [toolsData.tools],
  );

  const workflowPairs = useMemo(() => {
    const starts = new Map<string, { name: string; description?: string }>();
    const statuses = new Set<string>();
    for (const t of toolsData.tools) {
      const startMatch = t.name.match(/^DECO_WORKFLOW_([A-Z0-9_]+)_START$/);
      if (startMatch) {
        starts.set(startMatch[1], { name: startMatch[1], description: t.description });
      }
      const statusMatch = t.name.match(/^DECO_WORKFLOW_([A-Z0-9_]+)_GET_STATUS$/);
      if (statusMatch) statuses.add(statusMatch[1]);
    }
    const items: SearchResultItem[] = [];
    for (const [name, meta] of starts.entries()) {
      if (statuses.has(name)) {
        items.push({ uri: `DECO_WORKFLOW_${name}`, data: { name, description: meta.description } });
      }
    }
    return items;
  }, [toolsData.tools]);

  const filtered = useMemo(() => {
    const q = term.toLowerCase();
    if (!q) return workflowPairs;
    return workflowPairs.filter(
      (item) => (item.data?.name || "").toLowerCase().includes(q) || (item.data?.description || "").toLowerCase().includes(q),
    );
  }, [workflowPairs, term]);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2">
        <Input placeholder="Search workflows..." value={term} onChange={(e) => setTerm(e.target.value)} className="max-w-md" />
        <div />
      </div>

      {!hasSearchTool ? (
        <div className="w-full p-4 border border-border rounded-xl bg-muted/30">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon name="info" size={16} className="text-muted-foreground" />
            <span>Tool DECO_RESOURCE_WORKFLOW_SEARCH not available.</span>
          </div>
        </div>
      ) : null}

      <ScrollArea className="flex-1 h-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4">
          {isLoadingTools
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
            : filtered.map((item) => (
                <Card key={item.uri} className="p-4 rounded-xl border-border">
                  <div className="flex flex-col gap-2 w-full">
                    <div className="text-sm font-semibold truncate">{item.data?.name || item.uri}</div>
                    {item.data?.description && (
                      <div className="text-sm text-muted-foreground line-clamp-2">{item.data.description as string}</div>
                    )}
                  </div>
                </Card>
              ))}
        </div>
      </ScrollArea>
    </div>
  );
}


