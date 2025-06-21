import {
  type Prompt,
  useCreatePrompt,
  useDeletePrompt,
  usePrompts,
} from "@deco/sdk";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useReducer, useState, useEffect, useRef } from "react";
import { useNavigateWorkspace } from "../../../hooks/use-navigate-workspace.ts";
import { EmptyState } from "../../common/empty-state.tsx";
import { Table, type TableColumn } from "../../common/table/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../../layout.tsx";
import { Header } from "./common.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";

const DATE_TIME_PROMPT_NAME = "Date/Time Now";
const DATE_TIME_PROMPT_CONTENT = '<span data-type="datetime"></span>';

interface ListState {
  filter: string;
  deleteDialogOpen: boolean;
  promptToDelete: string | null;
  deleting: boolean;
}

type ListAction =
  | { type: "SET_FILTER"; payload: string }
  | { type: "CONFIRM_DELETE"; payload: string }
  | { type: "CANCEL_DELETE" }
  | { type: "DELETE_START" }
  | { type: "DELETE_END" };

const initialState: ListState = {
  filter: "",
  deleteDialogOpen: false,
  promptToDelete: null,
  deleting: false,
};

function listReducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case "SET_FILTER": {
      return { ...state, filter: action.payload };
    }
    case "CONFIRM_DELETE": {
      return {
        ...state,
        deleteDialogOpen: true,
        promptToDelete: action.payload,
      };
    }
    case "CANCEL_DELETE": {
      return { ...state, deleteDialogOpen: false, promptToDelete: null };
    }
    case "DELETE_START": {
      return { ...state, deleting: true };
    }
    case "DELETE_END": {
      return {
        ...state,
        deleting: false,
        deleteDialogOpen: false,
        promptToDelete: null,
      };
    }
    default: {
      return state;
    }
  }
}

function ListPromptsLayout() {
  const create = useCreatePrompt();
  const navigateWorkspace = useNavigateWorkspace();

  const handleCreate = async () => {
    const result = await create.mutateAsync({
      name: "New Prompt",
      content: "",
    });
    navigateWorkspace(`/prompt/${result.id}`);
  };

  return (
    <PageLayout
      displayViewsTrigger={false}
      breadcrumb={
        <DefaultBreadcrumb
          items={[
            { label: "Prompt Library", link: "/prompts" },
          ]}
        />
      }
      tabs={{
        prompts: {
          title: "Prompt Library",
          Component: ListPrompts,
          initialOpen: true,
        },
      }}
      actionButtons={
        <Button
          onClick={handleCreate}
          disabled={create.isPending}
          variant="special"
          className="gap-2"
        >
          {create.isPending
            ? (
              <>
                <Spinner size="xs" />
                <span>Creating prompt...</span>
              </>
            )
            : (
              <>
                <Icon name="add" />
                <span className="hidden md:inline">New Prompt</span>
              </>
            )}
        </Button>
      }
    />
  );
}

interface PromptActionsProps {
  onDelete: () => void;
  disabled?: boolean;
  isNativePrompt?: boolean;
}
function PromptActions({ onDelete, disabled, isNativePrompt }: PromptActionsProps) {
  // Don't show actions for native prompts
  if (isNativePrompt) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="focus:bg-accent/30"
          disabled={disabled}
        >
          <Icon name="more_vert" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={onDelete}
          className="text-destructive focus:bg-destructive/10"
        >
          <Icon name="delete" className="mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PromptCard({
  prompt,
  onConfigure,
  onDelete,
}: {
  prompt: Prompt;
  onConfigure: (prompt: Prompt) => void;
  onDelete: (promptId: string) => void;
}) {
  const isNativePrompt = prompt.name === DATE_TIME_PROMPT_NAME;
  
  return (
    <Card
      className={`group transition-shadow rounded-xl relative border-border ${
        isNativePrompt 
          ? "cursor-default" 
          : "cursor-pointer hover:shadow-md"
      }`}
      onClick={isNativePrompt ? undefined : () => onConfigure(prompt)}
    >
      <CardContent className="p-4">
        <div className="grid grid-cols-[1fr_min-content] gap-4 items-start">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-base font-semibold truncate">
                {prompt.name}
              </div>
              {prompt.name === DATE_TIME_PROMPT_NAME && (
                <Badge variant="secondary" className="text-xs">
                  Dynamic
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground line-clamp-3">
              {prompt.description || prompt.content}
            </div>
          </div>

          <div onClick={(e) => e.stopPropagation()}>
            <PromptActions 
              onDelete={() => onDelete(prompt.id)} 
              isNativePrompt={prompt.name === DATE_TIME_PROMPT_NAME}
            />
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
  onConfigure,
  onDelete,
}: {
  title: string;
  description?: string;
  prompts: Prompt[];
  onConfigure: (prompt: Prompt) => void;
  onDelete: (promptId: string) => void;
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {prompts.map((prompt) => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            onConfigure={onConfigure}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function CardsView(
  { prompts, onConfigure, onDelete }: {
    prompts: Prompt[];
    onConfigure: (prompt: Prompt) => void;
    onDelete: (promptId: string) => void;
  },
) {
  // Separate native and custom prompts
  const nativePrompts = prompts.filter(p => p.name === DATE_TIME_PROMPT_NAME);
  const customPrompts = prompts.filter(p => p.name !== DATE_TIME_PROMPT_NAME);

  return (
    <div className="space-y-8 peer">
      <PromptSection
        title="Native Prompts"
        description="Add or reference these utility prompts in your agents and chats"
        prompts={nativePrompts}
        onConfigure={onConfigure}
        onDelete={onDelete}
      />
      
      <PromptSection
        title="Custom Prompts"
        description="Your custom prompts and templates"
        prompts={customPrompts}
        onConfigure={onConfigure}
        onDelete={onDelete}
      />
    </div>
  );
}

function TableView(
  { prompts, onConfigure, onDelete }: {
    prompts: Prompt[];
    onConfigure: (prompt: Prompt) => void;
    onDelete: (promptId: string) => void;
  },
) {
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function getSortValue(row: Prompt, key: string): string {
    if (key === "description") return row.description?.toLowerCase() || "";
    return row.name?.toLowerCase() || "";
  }
  const sortedPrompts = [...prompts].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const columns: TableColumn<Prompt>[] = [
    {
      id: "name",
      header: "Name",
      render: (prompt) => (
        <div className="flex items-center gap-2">
          <span>{prompt.name}</span>
          {prompt.name === DATE_TIME_PROMPT_NAME && (
            <Badge variant="secondary" className="text-xs">
              Dynamic
            </Badge>
          )}
        </div>
      ),
      sortable: true,
    },
    {
      id: "description",
      header: "Description",
      accessor: (prompt) => prompt.description || prompt.content,
      sortable: true,
      cellClassName: "max-w-md",
    },
    {
      id: "actions",
      header: "",
      render: (prompt) => (
        <div onClick={(e) => e.stopPropagation()}>
          <PromptActions 
            onDelete={() => onDelete(prompt.id)} 
            isNativePrompt={prompt.name === DATE_TIME_PROMPT_NAME}
          />
        </div>
      ),
    },
  ];

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  const handleRowClick = (prompt: Prompt) => {
    // Don't allow clicking on native prompts
    if (prompt.name === DATE_TIME_PROMPT_NAME) {
      return;
    }
    onConfigure(prompt);
  };

  return (
    <Table
      columns={columns}
      data={sortedPrompts}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      onRowClick={handleRowClick}
    />
  );
}

function ListPrompts() {
  const [state, dispatch] = useReducer(listReducer, initialState);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const { data: prompts } = usePrompts();
  const create = useCreatePrompt();
  const deletePrompt = useDeletePrompt();
  const navigateWorkspace = useNavigateWorkspace();

  const { filter, deleteDialogOpen, promptToDelete, deleting } = state;

  const dateTimeCreationAttemptedRef = useRef(false);

  // Auto-create Date/Time Now prompt if it doesn't exist in main library
  useEffect(() => {
    if (prompts && !prompts.find(p => p.name === DATE_TIME_PROMPT_NAME) && 
        !create.isPending && !dateTimeCreationAttemptedRef.current) {
      
      dateTimeCreationAttemptedRef.current = true;
      create.mutateAsync({
        name: DATE_TIME_PROMPT_NAME,
        description: "Adds the current date and time to your prompt",
        content: DATE_TIME_PROMPT_CONTENT,
      }).catch((error) => {
        console.error('Failed to create Date/Time prompt in main library:', error);
        // Reset flag on error so it can be retried
        dateTimeCreationAttemptedRef.current = false;
      });
    }
  }, [prompts, create]);

  const filteredPrompts =
    prompts?.filter((prompt) =>
      prompt.name.toLowerCase().includes(filter.toLowerCase())
    ) ?? [];

  const handleConfigure = (prompt: Prompt) => {
    navigateWorkspace(`/prompt/${prompt.id}`);
  };
  const handleDeleteConfirm = (promptId: string) => {
    dispatch({ type: "CONFIRM_DELETE", payload: promptId });
  };
  const handleDelete = async () => {
    if (!promptToDelete) return;

    try {
      dispatch({ type: "DELETE_START" });

      await deletePrompt.mutateAsync(promptToDelete);
    } catch (error) {
      console.error("Error deleting prompt:", error);
    } finally {
      dispatch({ type: "DELETE_END" });
    }
  };
  const handleCreate = async () => {
    const result = await create.mutateAsync({
      name: "New Prompt",
      content: "",
    });
    navigateWorkspace(`/prompt/${result.id}`);
  };
  const handleDeleteDialogOpenChange = (open: boolean) => {
    if (!open && !deleting) {
      dispatch({ type: "CANCEL_DELETE" });
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full py-4">
      <div className="px-4 overflow-x-auto">
        <Header
          value={filter}
          setValue={(value) => dispatch({ type: "SET_FILTER", payload: value })}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
      </div>

      <div className="flex-1 min-h-0 px-4 overflow-x-auto">
        {!prompts
          ? (
            <div className="flex h-48 items-center justify-center">
              <Spinner size="lg" />
            </div>
          )
          : filteredPrompts.length === 0
          ? (
            <EmptyState
              icon="local_library"
              title={filter ? "No prompts found" : "No prompts yet"}
              description={filter 
                ? `No prompts found for "${filter}"`
                : "Create a prompt to get started."
              }
              buttonProps={filter ? undefined : {
                children: "Create a prompt",
                onClick: handleCreate,
              }}
            />
          )
          : (
            viewMode === "cards"
              ? (
                <CardsView
                  prompts={filteredPrompts}
                  onConfigure={handleConfigure}
                  onDelete={handleDeleteConfirm}
                />
              )
              : (
                <TableView
                  prompts={filteredPrompts}
                  onConfigure={handleConfigure}
                  onDelete={handleDeleteConfirm}
                />
              )
          )}
      </div>
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={handleDeleteDialogOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the prompt. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {deleting
                ? (
                  <>
                    <Spinner />
                    Deleting...
                  </>
                )
                : (
                  "Delete"
                )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Page() {
  return <ListPromptsLayout />;
}
