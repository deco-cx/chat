import React from "react";
import { useDiscoverWorkspaceTools } from "@/lib/hooks";
import { Loader, Package, Sparkles } from "lucide-react";
import { cn } from "@deco/ui/lib/utils.ts";

export function AvailableToolsList() {
  const [selectedIntegration, setSelectedIntegration] =
    React.useState<string>("");
  const { data, isLoading, error } = useDiscoverWorkspaceTools();

  // Filter tools client-side
  const filteredIntegrations = React.useMemo(() => {
    if (!data?.integrations) return [];
    if (!selectedIntegration) return data.integrations;
    return data.integrations.filter((i) => i.id === selectedIntegration);
  }, [data, selectedIntegration]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xs font-medium tracking-wider uppercase text-foreground">
          WORKSPACE INTEGRATIONS
        </h2>
        <p className="text-[11px] mt-1 text-muted-foreground">
          {data?.summary || "Loading workspace tools..."}
        </p>
      </div>

      {/* Integration Filters */}
      {data?.integrations && data.integrations.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedIntegration("")}
            className={cn(
              "px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-all uppercase tracking-wide border",
              !selectedIntegration
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/50",
            )}
          >
            ALL
          </button>
          {data.integrations.map((integration) => (
            <button
              key={integration.id}
              onClick={() => setSelectedIntegration(integration.id)}
              className={cn(
                "px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-all uppercase tracking-wide border",
                selectedIntegration === integration.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/50",
              )}
            >
              {integration.name} ({integration.toolCount})
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center p-12">
          <Loader className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-md bg-card border border-destructive">
          <p className="text-xs font-mono text-destructive">
            // ERROR: {error.message}
          </p>
        </div>
      )}

      {/* Integrations & Tools Grid */}
      {data && !isLoading && (
        <>
          {filteredIntegrations.length === 0 ? (
            <div className="p-12 text-center rounded-md bg-card border border-border">
              <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                // NO INTEGRATIONS FOUND
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredIntegrations.map((integration) => (
                <div key={integration.id} className="space-y-3">
                  {/* Integration Header */}
                  <div className="flex items-center gap-3 pb-3 border-b border-border">
                    {integration.icon ? (
                      <img
                        src={integration.icon}
                        alt={integration.name}
                        className="w-8 h-8 rounded"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded flex items-center justify-center bg-background">
                        <Package className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                        {integration.name}
                      </h3>
                      <p className="text-[10px] mt-0.5 text-muted-foreground">
                        {integration.toolCount} tools
                      </p>
                    </div>
                  </div>

                  {/* Tools Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {integration.tools.map((tool, idx) => (
                      <div
                        key={`${integration.id}-${tool.name}-${idx}`}
                        className="p-3 rounded-lg transition-all duration-200 bg-card border border-border hover:border-primary"
                      >
                        <div className="flex items-start gap-2">
                          <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-medium mb-1 text-foreground">
                              {tool.name}
                            </h4>
                            {tool.description && (
                              <p className="text-[10px] line-clamp-2 text-muted-foreground">
                                {tool.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
