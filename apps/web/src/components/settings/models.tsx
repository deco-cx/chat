import {
  isWellKnownModel,
  type Model,
  useCreateModel,
  useDeleteModel,
  useModels,
  useUpdateModel,
  WELL_KNOWN_MODELS,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { Switch } from "@deco/ui/components/switch.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { zodResolver } from "@hookform/resolvers/zod";
import { createContext, Suspense, useContext, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Avatar } from "../common/avatar/index.tsx";
import { Table, type TableColumn } from "../common/table/index.tsx";

interface ModelLogoProps {
  logo: string;
  name: string;
}

export function ModelLogo({ logo, name }: ModelLogoProps) {
  return (
    <div
      className={cn(
        "rounded-2xl relative flex items-center justify-center p-2 h-16 w-16",
        "before:content-[''] before:absolute before:inset-0 before:rounded-2xl before:p-[1px] before:bg-gradient-to-t before:from-border before:to-border/50",
        "before:![mask:linear-gradient(#000_0_0)_exclude_content-box,_linear-gradient(#000_0_0)]",
      )}
    >
      <Avatar
        shape="square"
        url={logo}
        fallback={name}
        objectFit="contain"
        size="base"
      />
    </div>
  );
}

const SORTABLE_KEYS = ["name", "active", "APIKey"] as const;

type SortKey = (typeof SORTABLE_KEYS)[number];
type SortDirection = "asc" | "desc";

function Title() {
  return (
    <div className="items-center justify-between hidden md:flex">
      <h2 className="text-2xl">Models</h2>
    </div>
  );
}

const Context = createContext<{
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}>({
  isOpen: false,
  setIsOpen: () => {
    throw new Error("setIsOpen is not implemented");
  },
});

function ModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Context.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </Context.Provider>
  );
}

function useModal() {
  const { isOpen, setIsOpen } = useContext(Context);
  return { isOpen, setIsOpen };
}

function Models() {
  return (
    <ModalProvider>
      <ScrollArea className="h-full text-foreground">
        <Suspense fallback={<span>Loading...</span>}>
          <ModelsView />
        </Suspense>
      </ScrollArea>
    </ModalProvider>
  );
}

function ModelsView() {
  const { data: models } = useModels({ excludeAuto: true });
  const { setIsOpen } = useModal();

  return (
    <div className="px-6 py-10 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Title />
        <Button
          variant="default"
          className="ml-auto"
          onClick={() => setIsOpen(true)}
        >
          <Icon name="add" className="mr-2 h-4 w-4" />
          Add Model
        </Button>
      </div>
      <div className="space-y-6">
        <TableView models={models} />
      </div>
    </div>
  );
}

const KeyCell = ({ model, onClick }: { model: Model; onClick: () => void }) => {
  if (model.byDeco) {
    return (
      <Button variant="outline" onClick={onClick}>
        Add Custom Key
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-2 px-4 py-2" onClick={onClick}>
      <Icon name="key" /> Custom Key
    </span>
  );
};

interface ModelActionsProps {
  model: Model;
  onEditClick: () => void;
  onDeleteClick: () => void;
}

const ModelActions = ({
  model,
  onEditClick,
  onDeleteClick,
}: ModelActionsProps) => {
  if (model.byDeco) {
    return undefined;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon name="more_vert" size={20} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onEditClick();
          }}
        >
          <Icon name="edit" className="h-4 w-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteClick();
          }}
        >
          <Icon name="delete" className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const ModelInfoCell = ({ model }: { model: Model }) => {
  return (
    <div className="flex items-center gap-2">
      {model.logo ? (
        <Avatar
          shape="square"
          url={model.logo}
          fallback={model.name}
          objectFit="contain"
          size="xs"
        />
      ) : (
        <Icon name="conversion_path" className="text-muted-foreground" />
      )}
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-medium line-clamp-1">{model.name}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{model.model}</p>
      </div>
    </div>
  );
};

const modelFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  model: z.string().min(1, "Model is required"),
  description: z.string().optional(),
  apiKey: z.string().min(1, "API Key is required"),
});

type ModelForm = z.infer<typeof modelFormSchema>;

function TableView({ models }: { models: Model[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("active");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const { isOpen: modalOpen, setIsOpen } = useModal();
  const [logo, setLogo] = useState<string | undefined>(undefined);
  const modelRef = useRef<Model | undefined>(undefined);

  const modalForm = useForm<ModelForm>({
    resolver: zodResolver(modelFormSchema),
  });
  const updateModel = useUpdateModel();
  const createModel = useCreateModel();
  const deleteModel = useDeleteModel();

  const isMutating = updateModel.isPending || createModel.isPending;

  function handleSort(key: string) {
    const k = key as SortKey;
    if (sortKey === k) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDirection("asc");
    }
  }

  async function handleModelDelete(model: Model) {
    if (model.byDeco) {
      return;
    }

    if (models.filter((m) => m.isEnabled).length === 1) {
      toast.error("You must have at least one enabled model");
      return;
    }

    await deleteModel.mutateAsync(model.id);
  }

  function getSortValue(model: Model, key: SortKey): string {
    if (key === "name") return model.name?.toLowerCase() || "";
    if (key === "active") return model.isEnabled ? "1" : "0";
    if (key === "APIKey") return model.hasCustomKey ? "1" : "0";
    return "";
  }

  const sortedModels = [...models].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const columns: TableColumn<Model>[] = [
    {
      id: "active",
      header: "",
      render: (model) => (
        <Switch
          className="cursor-pointer"
          onClick={(e) => e.stopPropagation()}
          checked={model.isEnabled}
          onCheckedChange={(checked: boolean) => {
            if (!checked && models.filter((m) => m.isEnabled).length === 1) {
              toast.error("You must have at least one enabled model");
              return;
            }

            const isInDatabase = !isWellKnownModel(model.id);

            if (!isInDatabase) {
              createModel.mutate({
                model: model.model,
                name: model.name,
                description: model.description,
                byDeco: true,
                isEnabled: checked,
              });
              return;
            }

            updateModel.mutate({
              id: model.id,
              data: { isEnabled: checked },
            });
          }}
        />
      ),
    },
    {
      id: "name",
      header: "Name",
      accessor: (model) => <ModelInfoCell model={model} />,
      sortable: true,
    },
    {
      id: "APIKey",
      header: "API Key",
      render: (model) => (
        <KeyCell
          model={model}
          onClick={() => handleModelOpenChange(true, model)}
        />
      ),
    },
    {
      id: "actions",
      header: "",
      render: (model) => (
        <ModelActions
          model={model}
          onEditClick={() => handleModelOpenChange(true, model)}
          onDeleteClick={() => handleModelDelete(model)}
        />
      ),
    },
  ];

  function handleModelOpenChange(open: boolean, model?: Model) {
    if (!open) {
      setIsOpen(false);
      modalForm.reset();
      modelRef.current = undefined;
      setLogo(undefined);
      return;
    }

    setIsOpen(true);

    const isCreatingNewModel = !model;

    if (isCreatingNewModel) {
      modalForm.reset({ name: "New Model - Team" });
      return;
    }

    const isDefaultModel = !!model?.byDeco;

    modalForm.reset({
      name: isDefaultModel ? `${model.name} - Team` : model.name,
      model: model.model,
      description: model.description,
      apiKey: undefined,
    });

    modelRef.current = model;
  }

  async function onSubmit(data: ModelForm) {
    const isDefaultModel = modelRef.current?.byDeco;

    if (isDefaultModel || !modelRef.current) {
      await createModel.mutateAsync({
        model: data.model,
        name: data.name,
        description: data.description,
        byDeco: false,
        isEnabled: true,
        apiKey: data.apiKey,
      });
    } else {
      await updateModel.mutateAsync({
        id: modelRef.current.id,
        data: {
          name: data.name,
          model: data.model,
          description: data.description,
          apiKey: data.apiKey,
        },
      });
    }

    handleModelOpenChange(false);
  }

  return (
    <>
      <Table
        columns={columns}
        data={sortedModels}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        onRowClick={(model) => handleModelOpenChange(true, model)}
      />
      <Dialog open={modalOpen} onOpenChange={handleModelOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Model</DialogTitle>
            <DialogDescription>Edit model details</DialogDescription>
          </DialogHeader>
          <Form {...modalForm}>
            <form
              onSubmit={modalForm.handleSubmit(onSubmit)}
              className="space-y-6"
            >
              <div className="flex items-center gap-6">
                <Avatar
                  shape="square"
                  url={logo || modelRef.current?.logo || ""}
                  fallback={modalForm.getValues("name")}
                  size="sm"
                />
                <FormField
                  control={modalForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="My GPT Model"
                          {...field}
                          disabled={isMutating}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={modalForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description of the model"
                        className="min-h-[100px]"
                        {...field}
                        disabled={isMutating}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={modalForm.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model Identifier</FormLabel>
                    <FormControl>
                      <Select
                        {...field}
                        defaultValue={modelRef.current?.model}
                        disabled={isMutating}
                        onValueChange={(value) => {
                          field.onChange(value);
                          const logo = WELL_KNOWN_MODELS.find(
                            (m) => m.model === value,
                          )?.logo;
                          if (logo) {
                            setLogo(logo);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select Model" />
                        </SelectTrigger>
                        <SelectContent>
                          {WELL_KNOWN_MODELS.map((model) => (
                            <SelectItem
                              key={model.model.split(":")[1]}
                              value={model.model}
                            >
                              {model.logo && (
                                <img
                                  src={model.logo}
                                  alt={model.name}
                                  className="w-6 h-6"
                                />
                              )}
                              {model.model.split(":")[1]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-end gap-3">
                <FormField
                  control={modalForm.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>API Key</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          {...field}
                          placeholder={
                            modelRef.current?.hasCustomKey
                              ? "••••••••••••••••••••••••••••••••••••••••••"
                              : ""
                          }
                          disabled={isMutating}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <Button type="submit" variant="default" disabled={isMutating}>
                  {isMutating ? "Saving..." : "Save"}
                </Button>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Discard
                  </Button>
                </DialogClose>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default Models;
