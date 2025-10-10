import {
  DocumentDefinitionSchema,
  useDocumentByUriV2,
  useUpdateDocument,
  useSDK,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useCallback, useState, useEffect, useRef } from "react";
import { z } from "zod";
import { EmptyState } from "../common/empty-state.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { DocumentEditor } from "./document-editor.tsx";
import { useDebouncedCallback } from "use-debounce";

// Document type inferred from the Zod schema
export type DocumentDefinition = z.infer<typeof DocumentDefinitionSchema>;

// Extended document type for display (includes optional metadata)
export interface DisplayDocument extends DocumentDefinition {
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface DocumentDetailProps {
  resourceUri: string;
}

/**
 * Document detail view with inline editing and markdown editor
 * Supports auto-save on changes with Figma-style UX
 */
export function DocumentDetail({ resourceUri }: DocumentDetailProps) {
  const { locator } = useSDK();
  const {
    data: resource,
    isLoading: isLoading,
    refetch,
  } = useDocumentByUriV2(resourceUri);
  const effectiveDocument = resource?.data;

  // Local state for inline editing
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Update mutation
  const updateMutation = useUpdateDocument();

  // Sync local state with fetched document
  useEffect(() => {
    if (effectiveDocument) {
      setTitle(effectiveDocument.name);
      setDescription(effectiveDocument.description || "");
      setContent(effectiveDocument.content);
      setTags(effectiveDocument.tags || []);
    }
  }, [effectiveDocument]);

  // Auto-save function with debounce - sends all fields to avoid validation errors
  const saveChanges = useDebouncedCallback(
    async (updatedFields: Partial<{ name: string; description: string; content: string; tags: string[] }>) => {
      if (!resourceUri) return;

      setIsSaving(true);
      try {
        // Always send all required fields to the API
        await updateMutation.mutateAsync({
          uri: resourceUri,
          params: {
            name: title,
            description: description,
            content: content,
            tags: tags,
            ...updatedFields, // Override with the specific changed fields
          },
        });
      } catch (error) {
        console.error("Failed to auto-save:", error);
        toast.error("Failed to save changes");
      } finally {
        setIsSaving(false);
      }
    },
    500,
  );

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (newTitle.trim()) {
      saveChanges({ name: newTitle });
    }
  };

  const handleDescriptionChange = (newDescription: string) => {
    setDescription(newDescription);
    saveChanges({ description: newDescription });
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    saveChanges({ content: newContent });
  };

  const handleAddTag = () => {
    if (newTagInput.trim() && !tags.includes(newTagInput.trim())) {
      const newTags = [...tags, newTagInput.trim()];
      setTags(newTags);
      setNewTagInput("");
      setIsAddingTag(false);
      saveChanges({ tags: newTags });
    }
  };

  const handleCancelAddTag = () => {
    setNewTagInput("");
    setIsAddingTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = tags.filter((tag) => tag !== tagToRemove);
    setTags(newTags);
    saveChanges({ tags: newTags });
  };

  // Auto-focus input when starting to add a tag
  useEffect(() => {
    if (isAddingTag && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [isAddingTag]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    try {
      setIsRefreshing(true);
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refetch]);

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center">
          <Icon
            name="refresh"
            size={24}
            className="animate-spin mx-auto mb-2"
          />
          <p className="text-muted-foreground">Loading document...</p>
        </div>
      </div>
    );
  }

  if (!effectiveDocument) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <EmptyState
          icon="error"
          title="Document not found"
          description="The requested document could not be found or is not available."
        />
      </div>
    );
  }

  if (!locator) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <EmptyState
          icon="error"
          title="No workspace"
          description="Unable to load document without workspace context."
        />
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col relative">
      {/* Header with refresh and save status */}
      <div className="border-b border-border bg-background px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Document</h2>
          {isSaving && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner size="xs" />
              <span>Saving...</span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
        >
          <Icon
            name="refresh"
            size={20}
            className={cn(isRefreshing && "animate-spin")}
          />
        </Button>
      </div>

      {/* Main content */}
      <ScrollArea className="flex-1 w-full">
        <div className="max-w-4xl mx-auto">
          {/* Metadata section - Figma-style inline editing */}
          <div className="px-8 py-6 space-y-4 border-b border-border">
            {/* Title - inline editable */}
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Untitled document"
              className="w-full text-4xl font-bold outline-none bg-transparent border-none px-0 py-2 placeholder:text-muted-foreground focus:ring-0"
            />

            {/* Description - inline editable */}
            <input
              type="text"
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="Add a description..."
              className="w-full text-base text-muted-foreground outline-none bg-transparent border-none px-0 placeholder:text-muted-foreground/50 focus:ring-0"
            />

            {/* Tags - inline editable with hover states */}
            <div className="flex gap-2 flex-wrap items-center">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="group cursor-default transition-colors inline-flex items-center"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hidden group-hover:inline-flex items-center ml-1 hover:text-destructive transition-colors"
                  >
                    <Icon name="close" size={12} />
                  </button>
                </Badge>
              ))}
              
              {/* Add tag button or input */}
              {isAddingTag ? (
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-border transition-colors">
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      } else if (e.key === "Escape") {
                        handleCancelAddTag();
                      }
                    }}
                    onBlur={(e) => {
                      // Check if the blur is caused by clicking the check button
                      if (!e.relatedTarget || !e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
                        handleCancelAddTag();
                      }
                    }}
                    placeholder="Tag name..."
                    className="bg-transparent outline-none border-none text-sm w-24 placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleAddTag();
                    }}
                    disabled={!newTagInput.trim()}
                    className="inline-flex items-center hover:text-primary transition-colors disabled:opacity-50"
                  >
                    <Icon name="check" size={12} />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsAddingTag(true)}
                  className="h-7 w-7 p-0 rounded-full"
                >
                  <Icon name="add" size={16} />
                </Button>
              )}
            </div>
          </div>

          {/* Document editor */}
          <div className="py-4">
            <DocumentEditor
              value={content}
              onChange={handleContentChange}
              locator={locator}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
