import React from "react";
import { createRoute, type RootRoute } from "@tanstack/react-router";
import { Loader, Play, Sparkles } from "lucide-react";
import { useExecuteToolSpec, useOptionalUser } from "@/lib/hooks";
import LoggedProvider from "@/components/logged-provider";
import { Button } from "@deco/ui/components/button.tsx";
import { UserButton } from "@/components/user-button";
import {
  PRE_MADE_TOOLS,
  TOOL_CATEGORIES,
  type ToolSpec,
} from "@/lib/pre-made-tools";
import { toast } from "sonner";
import { AvailableToolsList } from "@/components/AvailableToolsList";

function ToolExecutor() {
  const [selectedTool, setSelectedTool] = React.useState<ToolSpec | null>(null);
  const [toolInput, setToolInput] = React.useState("{}");
  const [selectedCategory, setSelectedCategory] = React.useState("All");
  const executeToolSpec = useExecuteToolSpec();

  const filteredTools =
    selectedCategory === "All"
      ? PRE_MADE_TOOLS
      : PRE_MADE_TOOLS.filter((t) => t.category === selectedCategory);

  const handleSelectTool = (tool: ToolSpec) => {
    setSelectedTool(tool);
    setToolInput(JSON.stringify(tool.exampleInput, null, 2));
    executeToolSpec.reset();
  };

  const handleExecute = () => {
    if (!selectedTool) return;

    try {
      const parsedInput = JSON.parse(toolInput);
      executeToolSpec.mutate({
        toolSpec: {
          name: selectedTool.name,
          description: selectedTool.description,
          inputSchema: selectedTool.inputSchema,
          outputSchema: selectedTool.outputSchema,
          executeCode: selectedTool.executeCode,
        },
        input: parsedInput,
      });
    } catch (error) {
      toast.error("Invalid JSON input");
    }
  };

  return (
    <div className="space-y-6">
      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {TOOL_CATEGORIES.map((category) => (
          <Button
            key={category}
            onClick={() => setSelectedCategory(category)}
            variant={selectedCategory === category ? "special" : "outline"}
            size="sm"
            className="text-xs uppercase tracking-wide"
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Tool Gallery */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => handleSelectTool(tool)}
            className={`text-left p-4 rounded-lg transition-all border-2 ${
              selectedTool?.id === tool.id
                ? "bg-primary-light/10 border-primary-light"
                : "bg-card border-border hover:border-primary-light"
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-wide mb-1 text-foreground">
              {tool.name}
            </div>
            <div className="text-[11px] mb-2 text-muted-foreground">
              {tool.description}
            </div>
            <div
              className={`inline-block px-2 py-1 rounded font-mono text-[10px] ${
                selectedTool?.id === tool.id
                  ? "bg-foreground/20 text-foreground"
                  : "bg-background text-muted-foreground"
              }`}
            >
              {tool.category}
            </div>
          </button>
        ))}
      </div>

      {/* Tool Executor */}
      {selectedTool ? (
        <div className="rounded-lg p-6 bg-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                {selectedTool.name}
              </h2>
              <p className="text-[11px] mt-1 text-muted-foreground">
                {selectedTool.description}
              </p>
            </div>
            <div className="px-3 py-1 rounded font-mono text-[10px] bg-background text-muted-foreground">
              {selectedTool.category}
            </div>
          </div>

          {/* Input Editor */}
          <div className="mb-4">
            <label className="block text-xs font-medium mb-2 font-mono uppercase tracking-wide text-muted-foreground">
              // INPUT (JSON):
            </label>
            <textarea
              value={toolInput}
              onChange={(e) => setToolInput(e.target.value)}
              className="w-full text-sm rounded-md px-3 py-2 font-mono min-h-[120px] bg-background border border-border text-foreground focus:border-primary-light focus:outline-none focus:ring-2 focus:ring-primary-light/20 transition-colors"
              placeholder="{}"
            />
          </div>

          {/* Execute Button */}
          <Button
            onClick={handleExecute}
            disabled={executeToolSpec.isPending}
            variant="special"
            className="w-full shadow-lg"
          >
            {executeToolSpec.isPending ? (
              <>
                <Loader className="w-4 h-4 animate-spin mr-2" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Tool
              </>
            )}
          </Button>

          {/* Execution Result */}
          {executeToolSpec.data && (
            <div className="mt-4 p-4 rounded-md bg-background border border-border">
              {executeToolSpec.data.success ? (
                <div className="font-mono">
                  <div className="text-xs font-medium mb-2 text-success">
                    // SUCCESS: true
                  </div>
                  <div className="text-xs font-medium mb-1 text-muted-foreground">
                    // RESULT:
                  </div>
                  <pre className="text-[10px] p-3 rounded overflow-x-auto bg-card text-success">
                    {JSON.stringify(executeToolSpec.data.result, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="font-mono">
                  <div className="text-xs font-medium mb-2 text-destructive">
                    // ERROR: true
                  </div>
                  <p className="text-xs text-destructive-foreground">
                    {executeToolSpec.data.error}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* View Code */}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
              View Code
            </summary>
            <pre className="mt-2 text-xs text-success bg-card p-3 rounded overflow-x-auto font-mono border border-border">
              {selectedTool.executeCode}
            </pre>
          </details>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            Select a Tool to Get Started
          </h3>
          <p className="text-sm text-muted-foreground">
            Choose from {PRE_MADE_TOOLS.length} pre-made tools above
          </p>
        </div>
      )}
    </div>
  );
}

function PublicFallback() {
  return (
    <div className="bg-card border border-border rounded-lg p-12 text-center">
      <h3 className="text-lg font-medium text-foreground mb-2">
        Login Required
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        Sign in to access pre-made tools and run them
      </p>
      <UserButton />
    </div>
  );
}

function HomePage() {
  const user = useOptionalUser();

  return (
    <div className="bg-background min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Deco"
              className="w-8 h-8 object-contain"
            />
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                AI Tool Runner
              </h1>
              <p className="text-sm text-muted-foreground">
                {PRE_MADE_TOOLS.length} ready-to-use tools
              </p>
            </div>
          </div>
          <UserButton />
        </div>

        {/* Main Content */}
        {user.data ? (
          <LoggedProvider>
            <div className="space-y-12">
              <AvailableToolsList />
              <ToolExecutor />
            </div>
          </LoggedProvider>
        ) : (
          <PublicFallback />
        )}
      </div>
    </div>
  );
}

export default (parentRoute: RootRoute) =>
  createRoute({
    path: "/",
    component: HomePage,
    getParentRoute: () => parentRoute,
  });
