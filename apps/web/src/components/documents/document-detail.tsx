import {
  DocumentDefinitionSchema,
  useDocumentByUriV2,
  useUpdateDocument,
  useSDK,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import { z } from "zod";
import { EmptyState } from "../common/empty-state.tsx";
import { DocumentEditor } from "./document-editor.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";

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
  const titleRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const shouldSyncRef = useRef(true); // Control when to sync from server

  // Update mutation
  const updateMutation = useUpdateDocument();

  // Track if there are unsaved changes
  const hasChanges = useMemo(() => {
    if (!effectiveDocument) return false;
    return (
      title !== effectiveDocument.name ||
      description !== (effectiveDocument.description || "") ||
      content !== effectiveDocument.content ||
      JSON.stringify(tags) !== JSON.stringify(effectiveDocument.tags || [])
    );
  }, [title, description, content, tags, effectiveDocument]);

  // Sync local state with fetched document (controlled by shouldSyncRef)
  useEffect(() => {
    if (effectiveDocument && shouldSyncRef.current) {
      setTitle(effectiveDocument.name);
      setDescription(effectiveDocument.description || "");
      setContent(effectiveDocument.content);
      setTags(effectiveDocument.tags || []);

      // Sync contentEditable divs
      if (titleRef.current) {
        titleRef.current.textContent = effectiveDocument.name;
      }
      if (descriptionRef.current) {
        descriptionRef.current.textContent =
          effectiveDocument.description || "";
      }

      // After syncing, don't sync again until explicitly requested
      shouldSyncRef.current = false;
    }
  }, [effectiveDocument]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
  };

  const handleDescriptionChange = (newDescription: string) => {
    setDescription(newDescription);
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  const handleAddTag = () => {
    if (newTagInput.trim() && !tags.includes(newTagInput.trim())) {
      const newTags = [...tags, newTagInput.trim()];
      setTags(newTags);
      setNewTagInput("");
      setIsAddingTag(false);
    }
  };

  const handleCancelAddTag = () => {
    setNewTagInput("");
    setIsAddingTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = tags.filter((tag) => tag !== tagToRemove);
    setTags(newTags);
  };

  // Auto-focus input when starting to add a tag
  useEffect(() => {
    if (isAddingTag && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [isAddingTag]);

  const handleSave = useCallback(async () => {
    if (!resourceUri || isSaving) return;

    setIsSaving(true);
    try {
      await updateMutation.mutateAsync({
        uri: resourceUri,
        params: {
          name: title,
          description: description,
          content: content,
          tags: tags,
        },
      });
      toast.success("Document saved successfully");
      // Allow sync after save to get the updated document from server
      shouldSyncRef.current = true;
      await refetch();
    } catch (error) {
      console.error("Failed to save document:", error);
      toast.error("Failed to save document");
    } finally {
      setIsSaving(false);
    }
  }, [
    resourceUri,
    title,
    description,
    content,
    tags,
    isSaving,
    updateMutation,
    refetch,
  ]);

  const handleDiscard = useCallback(() => {
    if (effectiveDocument) {
      setTitle(effectiveDocument.name);
      setDescription(effectiveDocument.description || "");
      setContent(effectiveDocument.content);
      setTags(effectiveDocument.tags || []);

      // Sync contentEditable divs
      if (titleRef.current) {
        titleRef.current.textContent = effectiveDocument.name;
      }
      if (descriptionRef.current) {
        descriptionRef.current.textContent =
          effectiveDocument.description || "";
      }
      toast.success("Changes discarded");
    }
  }, [effectiveDocument]);

  const handleRefresh = useCallback(() => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    // Allow sync to update local state with fresh data from server
    shouldSyncRef.current = true;
    refetch().finally(() => {
      setIsRefreshing(false);
    });
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
    <div className="h-full w-full">
      {/* Main content */}
      <ScrollArea className="h-full w-full [&_[data-radix-scroll-area-viewport]>div]:!block [&_[data-radix-scroll-area-viewport]>div]:!min-w-0 [&_[data-radix-scroll-area-viewport]>div]:!w-full">
        <div className="w-full max-w-3xl mx-auto pt-12">
          {/* Header section with title, description, and action buttons */}
          <div className="p-4 sm:px-6 md:px-8 border-b border-border">
            <div className="flex items-start justify-between gap-4">
              {/* Title and description */}
              <div className="flex-1 min-w-0 space-y-2.5">
                {/* Title - inline editable */}
                <div
                  ref={titleRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) =>
                    handleTitleChange(e.currentTarget.textContent || "")
                  }
                  onBlur={(e) => {
                    if (!e.currentTarget.textContent?.trim()) {
                      e.currentTarget.textContent = "";
                    }
                  }}
                  className="text-3xl font-semibold text-foreground leading-tight outline-none bg-transparent break-words overflow-wrap-anywhere empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:opacity-50"
                  data-placeholder="Untitled document"
                />

                {/* Description - inline editable */}
                <div
                  ref={descriptionRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) =>
                    handleDescriptionChange(e.currentTarget.textContent || "")
                  }
                  onBlur={(e) => {
                    if (!e.currentTarget.textContent?.trim()) {
                      e.currentTarget.textContent = "";
                    }
                  }}
                  className="text-base text-muted-foreground outline-none bg-transparent break-words overflow-wrap-anywhere empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:opacity-50"
                  data-placeholder="Add a description..."
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Reload button - always visible */}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="h-8 w-8 p-0 rounded-xl"
                >
                  <Icon
                    name="refresh"
                    size={16}
                    className={cn(isRefreshing && "animate-spin")}
                  />
                </Button>

                {/* Discard button - only visible when there are changes */}
                {hasChanges && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleDiscard}
                    disabled={isSaving}
                    className="h-8 px-3 rounded-xl"
                  >
                    Discard
                  </Button>
                )}

                {/* Save button - only visible when there are changes */}
                {hasChanges && (
                  <Button
                    type="button"
                    size="sm"
                    variant="special"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="h-8 px-3 rounded-xl"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                )}
              </div>
            </div>

            {/* Tags section */}
            <div className="py-6">
              <div className="flex gap-2.5 flex-wrap items-center">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="group cursor-default transition-colors text-sm inline-flex items-center"
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
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 w-fit rounded-full border border-border transition-colors">
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
                        if (
                          !e.relatedTarget ||
                          !e.currentTarget.parentElement?.contains(
                            e.relatedTarget as Node,
                          )
                        ) {
                          handleCancelAddTag();
                        }
                      }}
                      placeholder="Tag..."
                      size={newTagInput.length || 6}
                      className="bg-transparent outline-none border-none text-sm placeholder:text-muted-foreground placeholder:opacity-50"
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
                    className="size-6 text-muted-foreground p-0 rounded-full"
                  >
                    <Icon name="add" size={16} />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Document editor */}
          <div className="px-4 sm:px-6 md:px-8 pt-10 pb-20">
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
