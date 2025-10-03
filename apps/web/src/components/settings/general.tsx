import { useDeleteTeam, useSDK, useUpdateTeam, useWriteFile } from "@deco/sdk";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@deco/ui/components/alert-dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v3";
import { Avatar } from "../common/avatar/index.tsx";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { DEFAULT_THEME, THEME_VARIABLES, type ThemeVariable } from "@deco/sdk";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { clearThemeCache } from "../theme.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";

interface GeneralSettingsFormValues {
  teamName: string;
  teamSlug: string;
  workspaceEmailDomain: boolean;
  teamSystemPrompt: string;
  personalSystemPrompt: string;
  avatar: string;
  themeVariables: Record<string, string | undefined>;
}

const generalSettingsSchema = z.object({
  teamName: z.string(),
  teamSlug: z.string().regex(/^[a-zA-Z0-9_.-]+$/, {
    message:
      "Team slug can only contain letters, numbers, dashes, underscores, and dots.",
  }),
  workspaceEmailDomain: z.boolean(),
  teamSystemPrompt: z.string(),
  personalSystemPrompt: z.string(),
  avatar: z.string(),
  themeVariables: z.record(z.string(), z.string().optional()),
});

interface ThemeVariableState {
  key: ThemeVariable;
  value: string;
  isDefault: boolean;
  defaultValue: string;
}

function ThemeVariableInput({
  variable,
  onChange,
}: {
  variable: ThemeVariableState;
  onChange: (value: string) => void;
}) {
  // Convert any color format to hex for the color input
  const getHexColor = (color: string) => {
    if (!color) return "#000000";
    if (color.startsWith("#")) return color;
    // For non-hex colors, return a default color
    return "#000000";
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="text-sm font-medium">
          {variable.key.replace("--", "")}
        </div>
        {variable.isDefault && (
          <div className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            Default
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={variable.value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1"
            placeholder="Using default theme"
          />
          {!variable.isDefault && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onChange("")}
                    className="absolute right-2 top-0 bottom-0 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Reset to default</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="relative">
          <Input
            type="color"
            value={getHexColor(variable.value || variable.defaultValue)}
            onChange={(e) => onChange(e.target.value)}
            className="w-10 h-10 p-1 cursor-pointer rounded-md border-0 bg-transparent"
            style={{
              WebkitAppearance: "none",
              MozAppearance: "none",
              appearance: "none",
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none rounded-md border border-border"
            style={{
              backgroundColor:
                variable.value || variable.defaultValue || "#000000",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ThemeEditor({
  value,
  onChange,
}: {
  value: Record<string, string | undefined>;
  onChange: (value: Record<string, string | undefined>) => void;
}) {
  const variables = useMemo(() => {
    try {
      return THEME_VARIABLES.map((key) => ({
        key,
        value: String(value[key] || ""),
        isDefault: !value[key],
        defaultValue: DEFAULT_THEME.variables?.[key] || "",
      }));
    } catch {
      return THEME_VARIABLES.map((key) => ({
        key,
        value: "",
        isDefault: true,
        defaultValue: DEFAULT_THEME.variables?.[key] || "",
      }));
    }
  }, [value]);

  const handleVariableChange = (key: ThemeVariable, newValue: string) => {
    const currentValues = variables.reduce(
      (acc, { key, value, isDefault }) => ({
        ...acc,
        [key]: isDefault ? undefined : value,
      }),
      {},
    );

    const updatedValues = {
      ...currentValues,
      [key]: newValue,
    };

    onChange(updatedValues);
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {variables.map((variable) => (
        <ThemeVariableInput
          key={variable.key}
          variable={variable}
          onChange={(value) => handleVariableChange(variable.key, value)}
        />
      ))}
    </div>
  );
}

function DeleteTeamDialog({
  isOpen,
  onOpenChange,
  isReadOnly,
  isPending,
  onDelete,
  error,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isReadOnly: boolean;
  isPending: boolean;
  onDelete: () => Promise<void>;
  error: string | null;
}) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          className="w-fit"
          variant="destructive"
          disabled={isReadOnly || isPending}
        >
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Team?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the team
            and all its data.
          </AlertDialogDescription>
          {error && (
            <div className="text-destructive text-sm mt-2">{error}</div>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            disabled={isPending}
            onClick={async (e) => {
              e.stopPropagation();
              e.preventDefault();
              await onDelete();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <Spinner size="xs" variant="destructive" /> Deleting...
              </span>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const AVATAR_UPLOAD_SIZE_LIMIT = 1024 * 1024 * 5; // 5MB
const TEAM_AVATAR_PATH = "team-avatars";

export function GeneralSettings() {
  const {
    label: currentTeamName,
    slug: currentTeamSlug,
    avatarUrl,
    id: currentTeamId,
    theme: currentTeamTheme,
  } = useCurrentTeam();

  // If slug is empty, it's a personal team
  const isPersonalTeam = !currentTeamSlug;

  const { locator } = useSDK();
  const workspaceLink = useWorkspaceLink();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();
  const writeFile = useWriteFile();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup object URL when component unmounts or when localAvatarUrl changes
  useEffect(() => {
    return () => {
      if (localAvatarUrl) {
        URL.revokeObjectURL(localAvatarUrl);
      }
    };
  }, [localAvatarUrl]);

  const form = useForm<GeneralSettingsFormValues>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      teamName: currentTeamName,
      teamSlug: currentTeamSlug,
      workspaceEmailDomain: true,
      teamSystemPrompt: "",
      personalSystemPrompt: "",
      avatar: currentTeamTheme?.picture || "",
      themeVariables: currentTeamTheme?.variables ?? {},
    },
  });

  async function onSubmit(data: GeneralSettingsFormValues) {
    if (isPersonalTeam) return;

    // fixes batch removal of variables
    const currentVariables = currentTeamTheme?.variables ?? {};
    const themeVariables = data.themeVariables;
    Object.keys(currentVariables).forEach((key) => {
      if (!themeVariables[key]) {
        themeVariables[key] = "";
      }
    });

    // Upload file if one was selected
    let avatarUrl = data.avatar || "";
    if (selectedFile) {
      if (selectedFile.size > AVATAR_UPLOAD_SIZE_LIMIT) {
        toast.error("File size exceeds the limit of 5MB");
        setSelectedFile(null);
        setLocalAvatarUrl(null);
        return;
      }

      const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
      ];
      if (!allowedTypes.includes(selectedFile.type)) {
        toast.error("Please upload a PNG, JPEG, JPG, or WebP image file");
        setSelectedFile(null);
        setLocalAvatarUrl(null);
        return;
      }

      const filename = `${currentTeamSlug}-${crypto.randomUUID()}.${
        selectedFile.name.split(".").pop() || "png"
      }`;
      const path = `${TEAM_AVATAR_PATH}/${filename}`;
      await writeFile.mutateAsync({
        path,
        content: new Uint8Array(await selectedFile.arrayBuffer()),
        contentType: selectedFile.type,
      });
      avatarUrl = path;
    }

    await updateTeam.mutateAsync({
      id:
        typeof currentTeamId === "number"
          ? currentTeamId
          : Number(currentTeamId) || 0,
      data: {
        name: data.teamName,
        slug: data.teamSlug,
        theme: {
          picture: avatarUrl,
          variables: themeVariables,
        },
      },
    });
    clearThemeCache(locator);
    form.reset(data);

    // Show toast with refresh button if theme variables were changed
    if (Object.keys(data.themeVariables).length > 0) {
      toast(
        <div className="flex items-center gap-2">
          <span>Refresh the page to see theme changes</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => globalThis.location.reload()}
          >
            Refresh
          </Button>
        </div>,
        {
          duration: 10000, // Show for 10 seconds
        },
      );
    }
  }

  const isReadOnly = isPersonalTeam;

  return (
    <ScrollArea className="h-full text-foreground">
      <div className="container h-full max-w-7xl text-foreground">
        <div className="h-full overflow-auto py-20 md:px-[120px]">
          <div className="flex flex-col gap-6 w-full">
            <div className="max-w-2xl mx-auto space-y-8">
              <Form {...form}>
                <form
                  className="space-y-8"
                  onSubmit={form.handleSubmit(onSubmit)}
                >
                  <div className="flex flex-col items-center w-full">
                    <FormField
                      control={form.control}
                      name="avatar"
                      render={({
                        field: { value: _value, onChange, ...field },
                      }) => (
                        <FormItem className="w-full flex flex-col items-center">
                          <FormControl>
                            <div
                              className="relative group cursor-pointer"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <Avatar
                                shape="square"
                                fallback={currentTeamName}
                                url={localAvatarUrl || avatarUrl}
                                objectFit="contain"
                                size="2xl"
                                className="group-hover:opacity-50 transition-opacity"
                              />
                              <div className="absolute top-0 left-0 w-20 h-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Icon
                                  name="upload"
                                  size={32}
                                  className="text-white"
                                />
                              </div>
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                maxLength={AVATAR_UPLOAD_SIZE_LIMIT}
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null;
                                  if (file) {
                                    if (file.size > AVATAR_UPLOAD_SIZE_LIMIT) {
                                      toast.error(
                                        "File size exceeds the limit of 5MB",
                                      );
                                      e.target.value = ""; // Clear the file input
                                      return;
                                    }
                                    setSelectedFile(file);
                                    const objectUrl = URL.createObjectURL(file);
                                    setLocalAvatarUrl(objectUrl);
                                    onChange(objectUrl);
                                  }
                                }}
                                disabled={isReadOnly}
                              />
                              <Input
                                type="text"
                                className="hidden"
                                {...field}
                                disabled={isReadOnly}
                              />
                            </div>
                          </FormControl>
                          <FormDescription className="text-center">
                            Click to upload a team avatar
                          </FormDescription>
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="teamName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Team Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="The name of your company or organization"
                            readOnly={isReadOnly}
                            disabled={isReadOnly}
                          />
                        </FormControl>
                        <FormDescription>
                          The name of your company or organization
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="teamSlug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Team Slug</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="your-team"
                            readOnly
                            disabled
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="teamSystemPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Team System Prompt</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="This prompt is added at the start of all agent messages for your team. Use it to set tone, context, or rules."
                            rows={6}
                            disabled
                            readOnly={isReadOnly}
                          />
                        </FormControl>
                        <FormDescription>
                          This prompt is added at the start of all agent
                          messages for your team. Use it to set tone, context,
                          or rules.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  <Separator />
                  <FormField
                    control={form.control}
                    name="personalSystemPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Personal System Prompt</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="This prompt is added at the end of agent messages just for you. Use it to personalize style or add your own context."
                            rows={6}
                            disabled
                            readOnly={isReadOnly}
                          />
                        </FormControl>
                        <FormDescription>
                          This prompt is added at the end of agent messages just
                          for you. Use it to personalize style or add your own
                          context.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="themeVariables"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Theme Variables</FormLabel>
                        <FormDescription>
                          Customize the theme of your team. Variables left blank
                          will use the default theme.
                        </FormDescription>
                        <FormControl>
                          <ThemeEditor
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="p-6 bg-muted rounded-lg">
                    <div className="flex flex-col gap-2">
                      <h3 className="font-semibold">Delete Team</h3>
                      <p className="text-xs text-muted-foreground">
                        Permanently remove this team, all its connected
                        integrations and uploaded data
                      </p>
                      <DeleteTeamDialog
                        isOpen={isDeleteDialogOpen}
                        onOpenChange={(open) => {
                          setIsDeleteDialogOpen(open);
                          if (!open) setDeleteError(null);
                        }}
                        isReadOnly={isReadOnly}
                        isPending={deleteTeam.isPending}
                        error={deleteError}
                        onDelete={async () => {
                          setDeleteError(null);
                          if (!currentTeamId) return;
                          try {
                            await deleteTeam.mutateAsync(
                              typeof currentTeamId === "number"
                                ? currentTeamId
                                : Number(currentTeamId) || 0,
                            );
                            // Do not close the dialog automatically
                            globalThis.location.href = workspaceLink("/");
                          } catch (err) {
                            setDeleteError(
                              err instanceof Error
                                ? err.message
                                : "Failed to delete team.",
                            );
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => form.reset()}
                      disabled={
                        isReadOnly ||
                        !form.formState.isDirty ||
                        form.formState.isSubmitting
                      }
                    >
                      Discard
                    </Button>
                    <Button
                      type="submit"
                      variant="default"
                      disabled={
                        isReadOnly ||
                        !form.formState.isDirty ||
                        form.formState.isSubmitting ||
                        updateTeam.isPending
                      }
                    >
                      {updateTeam.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

export default GeneralSettings;
