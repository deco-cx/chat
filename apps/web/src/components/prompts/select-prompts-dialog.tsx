import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { useMemo, useState } from "react";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { type Prompt, usePrompts, useCreatePrompt } from "@deco/sdk";
import { cn } from "@deco/ui/lib/utils.ts";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { EmptyState } from "../common/empty-state.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";

function PromptCard({
  prompt,
  onSelect,
  isSelected,
}: {
  prompt: Prompt;
  onSelect: (prompt: Prompt) => void;
  isSelected: boolean;
}) {
  return (
    <Card
      className={cn(
        "group cursor-pointer hover:shadow-md transition-shadow rounded-xl relative border-border",
        isSelected && "border-primary bg-primary/5"
      )}
      onClick={() => onSelect(prompt)}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-base font-semibold truncate">
                {prompt.name}
              </div>
              {prompt.name === "Date/Time Now" && (
                <Badge variant="secondary" className="text-xs">
                  Dynamic
                </Badge>
              )}
            </div>
            {isSelected && (
              <Icon name="check" size={16} className="text-primary" />
            )}
          </div>
          <div className="text-sm text-muted-foreground line-clamp-3">
            {prompt.description || prompt.content}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PromptSection({
  title,
  description,
  prompts,
  selectedPrompts,
  onTogglePrompt,
}: {
  title: string;
  description?: string;
  prompts: Prompt[];
  selectedPrompts: Set<string>;
  onTogglePrompt: (prompt: Prompt) => void;
}) {
  if (prompts.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="border-b pb-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {prompts.map((prompt) => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            onSelect={onTogglePrompt}
            isSelected={selectedPrompts.has(prompt.id)}
          />
        ))}
      </div>
    </div>
  );
}

function PromptsGrid({
  prompts,
  selectedPrompts,
  onTogglePrompt,
}: {
  prompts: Prompt[];
  selectedPrompts: Set<string>;
  onTogglePrompt: (prompt: Prompt) => void;
}) {
  // Separate native and custom prompts
  const nativePrompts = prompts.filter((p) => p.name === DATE_TIME_PROMPT_NAME);
  const customPrompts = prompts.filter((p) => p.name !== DATE_TIME_PROMPT_NAME);

  return (
    <div className="space-y-8">
      <PromptSection
        title="Native Prompts"
        description="Add or reference these utility prompts in your agents and chats"
        prompts={nativePrompts}
        selectedPrompts={selectedPrompts}
        onTogglePrompt={onTogglePrompt}
      />
      
      <PromptSection
        title="Custom Prompts"
        description="Your custom prompts and templates"
        prompts={customPrompts}
        selectedPrompts={selectedPrompts}
        onTogglePrompt={onTogglePrompt}
      />
    </div>
  );
}

const DATE_TIME_PROMPT_NAME = "Date/Time Now";
const DATE_TIME_PROMPT_CONTENT = '<span data-type="datetime"></span>';

function SelectPromptsDialogContent({
  selectedPromptIds = [],
  onSelect,
}: {
  selectedPromptIds?: string[];
  onSelect?: (promptIds: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const { data: prompts } = usePrompts();
  const createPrompt = useCreatePrompt();
  const [selectedPrompts, setSelectedPrompts] = useState<Set<string>>(
    new Set(selectedPromptIds)
  );
  
  // Note: Date/Time Now prompt auto-creation is handled in main prompt library

  const filteredPrompts = prompts?.filter(prompt => 
    prompt.name.toLowerCase().includes(search.toLowerCase()) ||
    (prompt.description?.toLowerCase().includes(search.toLowerCase()))
  ) ?? [];

  const handleTogglePrompt = (prompt: Prompt) => {
    setSelectedPrompts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(prompt.id)) {
        newSet.delete(prompt.id);
      } else {
        newSet.add(prompt.id);
      }
      return newSet;
    });
  };

  const handleConfirm = () => {
    onSelect?.(Array.from(selectedPrompts));
  };

  return (
    <DialogContent
      className="p-0 min-w-[80vw] min-h-[80vh] gap-0"
      closeButtonClassName="top-5 right-4"
    >
      <DialogHeader className="flex flex-row justify-between items-center p-2 h-14 px-5 pr-12">
        <DialogTitle>Add Prompts</DialogTitle>
        <Button onClick={handleConfirm} variant="special">
          Add {selectedPrompts.size} prompt{selectedPrompts.size !== 1 ? 's' : ''}
        </Button>
      </DialogHeader>
      
      <div className="h-[calc(100vh-10rem)] p-4">
        <Input
          placeholder="Find prompts..."
          value={search}
          className="mb-4"
          onChange={(e) => setSearch(e.target.value)}
        />
        
        {!prompts ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : filteredPrompts.length === 0 ? (
          <EmptyState
            icon="local_library"
            title="No prompts found"
            description={search 
              ? `No prompts found for "${search}"`
              : "Create a prompt to get started."
            }
          />
        ) : (
          <div className="h-full overflow-y-auto pb-20">
            <PromptsGrid
              prompts={filteredPrompts}
              selectedPrompts={selectedPrompts}
              onTogglePrompt={handleTogglePrompt}
            />
          </div>
        )}
      </div>
    </DialogContent>
  );
}

interface SelectPromptsDialogProps {
  trigger?: React.ReactNode;
  selectedPromptIds?: string[];
  onSelect?: (promptIds: string[]) => void;
}

export function SelectPromptsDialog(props: SelectPromptsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const trigger = useMemo(() => {
    if (props.trigger) {
      return props.trigger;
    }

    return (
      <Button variant="outline">
        <Icon name="add" size={16} />
        <span>Add Prompts</span>
      </Button>
    );
  }, [props.trigger]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <SelectPromptsDialogContent
        selectedPromptIds={props.selectedPromptIds}
        onSelect={(promptIds) => {
          props.onSelect?.(promptIds);
          setIsOpen(false);
        }}
      />
    </Dialog>
  );
}