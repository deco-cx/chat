import { useCallback, useMemo, useState } from "react";
import { Button } from "@deco/ui/components/button.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Plus, Sparkles, X, Wand2 } from "lucide-react";
import type { Workflow, WorkflowStep } from "@deco/sdk";
import { useGenerateWorkflowStep, useIntegrations } from "@deco/sdk";
import { useDebouncedCallback } from "use-debounce";

interface StepCreatorProps {
  workflow: Workflow;
  editingStep?: WorkflowStep | null;
  onStepCreated: (step: WorkflowStep) => void;
  onCancel: () => void;
}

/**
 * AI-powered step creator that displays inline as a pseudo-step
 * Simple two-field interface: Prompt and Tools
 */
export function StepCreator({
  workflow,
  editingStep,
  onStepCreated,
  onCancel,
}: StepCreatorProps) {
  const [prompt, setPrompt] = useState(editingStep?.prompt || "");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [suggestedTools, setSuggestedTools] = useState<string[]>([]);
  const [showToolDialog, setShowToolDialog] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedStep, setGeneratedStep] = useState<WorkflowStep | null>(null);

  const { data: integrations } = useIntegrations();
  const generateStep = useGenerateWorkflowStep();

  // Tool discovery based on prompt
  const discoverTools = useDebouncedCallback((text: string) => {
    if (text.length < 10) {
      setSuggestedTools([]);
      return;
    }

    // Simple keyword matching for now
    const keywords = text.toLowerCase().split(/\s+/);
    const suggested =
      integrations
        ?.filter((integration) => {
          const name = integration.name.toLowerCase();
          return keywords.some((keyword) => name.includes(keyword));
        })
        .map((i) => i.id.replace(/^[ia]_/, ""))
        .slice(0, 3) || [];

    setSuggestedTools(suggested);
  }, 1500);

  // Watch prompt changes
  useMemo(() => {
    discoverTools(prompt);
  }, [prompt, discoverTools]);

  // Handle @ mentions
  const handlePromptChange = useCallback(
    (value: string) => {
      setPrompt(value);

      // Extract @ mentions
      const mentions = value.match(/@(\w+)/g) || [];
      const mentionedTools = mentions.map((m) => m.slice(1));

      // Add mentioned tools to selected
      const newTools = mentionedTools.filter((t) => !selectedTools.includes(t));
      if (newTools.length > 0) {
        setSelectedTools([...selectedTools, ...newTools]);
      }
    },
    [selectedTools],
  );

  const handleGenerate = async () => {
    if (!prompt.trim() || prompt.length < 10) return;

    setIsGenerating(true);

    try {
      // Get previous steps for context
      const previousSteps = workflow.steps.map((s: WorkflowStep) => ({
        id: s.id,
        title: s.title,
        outputSchema: s.outputSchema,
      }));

      // Generate step using AI
      const generated = await generateStep.mutateAsync({
        prompt,
        selectedTools,
        previousSteps,
      });

      // Create the complete step with generated data
      // Extract a meaningful title from the prompt
      const extractTitle = (prompt: string): string => {
        // Common patterns for extracting intent
        const patterns = [
          /^(send|create|get|fetch|update|delete|process)\s+(.+?)(?:\s+from|\s+to|\s+with|\s+and|$)/i,
          /^(.+?)(?:\s+from|\s+to|\s+with|\s+and|$)/i,
        ];

        for (const pattern of patterns) {
          const match = prompt.match(pattern);
          if (match) {
            const action = match[1] || "";
            const target = match[2] || "";
            return `${action} ${target}`
              .trim()
              .split(" ")
              .slice(0, 4) // Max 4 words
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(" ");
          }
        }

        // Fallback: First few words
        return prompt
          .split(" ")
          .slice(0, 3)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");
      };

      const newStep: WorkflowStep = {
        id: editingStep?.id || `step-${Date.now()}`,
        title: extractTitle(prompt),
        description: `Executes: ${prompt.slice(0, 100)}${prompt.length > 100 ? "..." : ""}`,
        prompt,
        code: generated.code,
        inputSchema: generated.inputSchema as Record<string, unknown>,
        outputSchema: generated.outputSchema as Record<string, unknown>,
        usedTools: generated.usedTools || [],
        config: {
          retry: 3,
          timeout: 30000,
        },
      };

      setGeneratedStep(newStep);
    } catch (error) {
      console.error("Failed to generate step:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const availableTools = useMemo(() => {
    return (
      integrations
        ?.filter((i) => !i.id.startsWith("a_"))
        .map((i) => ({
          id: i.id.replace(/^[ia]_/, ""),
          name: i.name,
          icon: i.icon,
        })) || []
    );
  }, [integrations]);

  // If step was generated, show the generated view
  if (generatedStep) {
    return (
      <div className="h-full flex items-center justify-center p-12">
        <div className="max-w-4xl w-full space-y-8">
          {/* Generated Step Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-success mb-4">
              <Sparkles className="w-6 h-6" />
              <span className="text-sm font-medium">Step Generated!</span>
            </div>
            <h1 className="text-4xl font-bold text-foreground">
              {generatedStep.title}
            </h1>
            <p className="text-xl text-muted-foreground">
              {generatedStep.description}
            </p>
          </div>

          {/* Generated Step Content */}
          <div className="bg-white rounded-xl shadow-sm p-8 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Original Prompt
              </h3>
              <p className="text-lg text-foreground leading-relaxed">
                {generatedStep.prompt}
              </p>
            </div>

            {generatedStep.usedTools && generatedStep.usedTools.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Tools Used
                </h3>
                <div className="flex flex-wrap gap-2">
                  {generatedStep.usedTools.map(
                    (
                      tool: { integrationId?: string; toolName?: string },
                      idx: number,
                    ) => (
                      <Badge key={idx} variant="secondary">
                        {String(tool.integrationId)}.{String(tool.toolName)}
                      </Badge>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-4">
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                setGeneratedStep(null);
                setPrompt("");
                setSelectedTools([]);
              }}
            >
              Start Over
            </Button>
            <Button size="lg" onClick={() => onStepCreated(generatedStep)}>
              <Sparkles className="w-5 h-5 mr-2" />
              Save Step
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show the creation form as a pseudo-step
  return (
    <>
      <div className="h-full flex items-center justify-center p-12">
        <div className="max-w-4xl w-full space-y-8">
          {/* Pseudo-Step Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-primary mb-4">
              <Wand2 className="w-6 h-6" />
              <span className="text-sm font-medium">Creating New Step</span>
            </div>
            <h1 className="text-4xl font-bold text-foreground">
              {editingStep ? "Edit Step" : "New Step"}
            </h1>
            <p className="text-xl text-muted-foreground">
              Describe what this step should do
            </p>
          </div>

          {/* Creation Form - styled like a step */}
          <div className="bg-primary/10 border-2 border-primary/20 rounded-xl p-8 space-y-6">
            {/* Prompt Field */}
            <div>
              <label className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3 block">
                What do you want this step to do?
              </label>
              <Textarea
                value={prompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                placeholder="Get the user data from the previous step and send them a welcome email with their name and account details..."
                className="min-h-[150px] text-lg leading-relaxed resize-none bg-white"
                autoFocus
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-muted-foreground">
                  Use @ to mention tools (e.g., @gmail, @sheets)
                </span>
                <span className="text-sm text-muted-foreground">
                  {prompt.length} characters
                </span>
              </div>
            </div>

            {/* Tools Section */}
            <div>
              <label className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3 block">
                Tools
              </label>

              {/* Suggested Tools */}
              {suggestedTools.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    Suggested:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedTools.map((toolId) => {
                      const tool = availableTools.find((t) => t.id === toolId);
                      if (!tool) return null;
                      const isSelected = selectedTools.includes(tool.id);

                      return (
                        <Badge
                          key={tool.id}
                          variant={isSelected ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedTools(
                                selectedTools.filter((t) => t !== tool.id),
                              );
                            } else {
                              setSelectedTools([...selectedTools, tool.id]);
                            }
                          }}
                        >
                          <Sparkles className="w-3 h-3 mr-1" />
                          {tool.name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Selected Tools */}
              <div className="flex flex-wrap gap-2">
                {selectedTools.map((toolId) => {
                  const tool = availableTools.find((t) => t.id === toolId);
                  if (!tool) return null;

                  return (
                    <Badge
                      key={tool.id}
                      variant="default"
                      className="cursor-pointer"
                    >
                      {tool.name}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedTools(
                            selectedTools.filter((t) => t !== tool.id),
                          )
                        }
                        className="ml-2"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  );
                })}

                {/* Add Tool Button */}
                <button
                  type="button"
                  onClick={() => setShowToolDialog(true)}
                  className="h-7 px-3 rounded-md border border-border bg-white hover:bg-muted text-sm font-medium inline-flex items-center"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Tool
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4">
            <Button
              size="lg"
              variant="outline"
              onClick={onCancel}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={isGenerating || prompt.length < 10}
            >
              {isGenerating ? (
                <>
                  <Spinner />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate Step
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Tool Selection Dialog */}
      {showToolDialog && (
        <Dialog open={showToolDialog} onOpenChange={setShowToolDialog}>
          <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Select Tools</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 mt-4">
              {availableTools.map((tool) => {
                const isSelected = selectedTools.includes(tool.id);

                return (
                  <button
                    type="button"
                    key={tool.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedTools(
                          selectedTools.filter((t) => t !== tool.id),
                        );
                      } else {
                        setSelectedTools([...selectedTools, tool.id]);
                      }
                      setShowToolDialog(false);
                    }}
                    className={`
                      p-4 rounded-lg border-2 text-left transition-all
                      ${
                        isSelected
                          ? "border-blue-500 bg-primary/10"
                          : "border-gray-200 hover:border-border hover:bg-muted"
                      }
                    `}
                  >
                    <div className="font-medium">{tool.name}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      ID: {tool.id}
                    </div>
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
