import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { type Prompt, usePrompts } from "@deco/sdk";
import { useMemo } from "react";

interface SelectedPromptsProps {
  promptIds: string[];
  onRemovePrompt: (promptId: string) => void;
}

export function SelectedPrompts({ promptIds, onRemovePrompt }: SelectedPromptsProps) {
  const { data: allPrompts } = usePrompts();

  const selectedPrompts = useMemo(() => {
    if (!allPrompts || !promptIds.length) return [];
    return promptIds.map(id => allPrompts.find(p => p.id === id)).filter(Boolean) as Prompt[];
  }, [allPrompts, promptIds]);

  if (!selectedPrompts.length) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted-foreground">
        Additional Prompts ({selectedPrompts.length})
      </div>
      <div className="space-y-2">
        {selectedPrompts.map((prompt) => (
          <div
            key={prompt.id}
            className="flex items-center justify-between p-3 bg-muted/50 border border-border rounded-lg"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{prompt.name}</span>
                {prompt.name === "Date/Time Now" && (
                  <Badge variant="secondary" className="text-xs">
                    Dynamic
                  </Badge>
                )}
              </div>
              {prompt.description && (
                <div className="text-xs text-muted-foreground mt-1">
                  {prompt.description}
                </div>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRemovePrompt(prompt.id)}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            >
              <Icon name="close" size={16} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}