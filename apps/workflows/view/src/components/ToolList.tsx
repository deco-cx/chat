/**
 * TOOL LIST - Integration Catalog Panel
 *
 * Inspired by: Control panel equipment selection, parts catalog
 * Features: Searchable, categorized, collapsible integration groups
 */

import { useState } from "react";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@deco/ui/components/input.tsx";
import { Button } from "@deco/ui/components/button.tsx";

interface Tool {
  id: string;
  name: string;
  description: string;
}

interface Integration {
  id: string;
  name: string;
  tools: Tool[];
}

interface ToolListProps {
  integrations: Integration[];
  onToolClick?: (toolId: string) => void;
}

export function ToolList({ integrations, onToolClick }: ToolListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIntegrations, setExpandedIntegrations] = useState<Set<string>>(
    new Set(),
  );

  // Filter integrations based on search
  const filteredIntegrations = integrations
    .map((integration) => ({
      ...integration,
      tools: integration.tools.filter(
        (tool) =>
          tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tool.description.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    }))
    .filter((integration) => integration.tools.length > 0);

  const totalTools = integrations.reduce(
    (sum, int) => sum + int.tools.length,
    0,
  );

  const toggleIntegration = (integrationId: string) => {
    setExpandedIntegrations((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(integrationId)) {
        newSet.delete(integrationId);
      } else {
        newSet.add(integrationId);
      }
      return newSet;
    });
  };

  const handleToolClick = (toolId: string) => {
    onToolClick?.(toolId);
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-5 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-success shadow-[0_0_10px_rgba(74,222,128,0.5)] animate-pulse" />
          <h3 className="text-lg font-bold text-foreground m-0">
            Available Tools
          </h3>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-6 py-5 border-b border-border">
        <div className="relative mb-3">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10"
          />
          <Input
            type="text"
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">
            {filteredIntegrations.length} integrations
          </span>
          <span className="text-success font-semibold">{totalTools} tools</span>
        </div>
      </div>

      {/* Tool List - Scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {filteredIntegrations.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            No tools found
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredIntegrations.map((integration) => (
              <IntegrationGroup
                key={integration.id}
                integration={integration}
                isExpanded={expandedIntegrations.has(integration.id)}
                onToggle={() => toggleIntegration(integration.id)}
                onToolClick={handleToolClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface IntegrationGroupProps {
  integration: Integration;
  isExpanded: boolean;
  onToggle: () => void;
  onToolClick: (toolId: string) => void;
}

function IntegrationGroup({
  integration,
  isExpanded,
  onToggle,
  onToolClick,
}: IntegrationGroupProps) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Integration Header - Clickable */}
      <Button
        onClick={onToggle}
        variant="ghost"
        className="w-full flex items-center justify-between px-4 py-3.5 h-auto rounded-none hover:bg-accent"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown size={16} className="text-muted-foreground" />
          ) : (
            <ChevronRight size={16} className="text-muted-foreground" />
          )}
          <span className="text-sm font-semibold text-foreground">
            {integration.name}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          ({integration.tools.length})
        </span>
      </Button>

      {/* Tools List - Collapsible */}
      {isExpanded && (
        <div className="border-t border-border p-2 bg-card/50">
          {integration.tools.map((tool) => (
            <Button
              key={tool.id}
              onClick={() => onToolClick(tool.id)}
              variant="ghost"
              className="w-full flex flex-col items-start gap-1 h-auto p-3 rounded-md border border-transparent hover:bg-accent hover:border-success justify-start"
              title={`Click to insert @${tool.name}`}
            >
              <span className="text-xs font-semibold text-success font-mono">
                {tool.name}
              </span>
              <span className="text-xs text-muted-foreground leading-relaxed">
                {tool.description}
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
