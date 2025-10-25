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
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Avatar } from "../common/avatar/index.tsx";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";

interface GeneralSettingsFormValues {
  teamName: string;
  teamSlug: string;
  workspaceEmailDomain: boolean;
  avatar: string;
}

const generalSettingsSchema = z.object({
  teamName: z.string(),
  teamSlug: z.string().regex(/^[a-zA-Z0-9_.-]+$/, {
    message:
      "Team slug can only contain letters, numbers, dashes, underscores, and dots.",
  }),
  workspaceEmailDomain: z.boolean(),
  avatar: z.string(),
});

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
      avatar: currentTeamTheme?.picture || "",
    },
  });

  async function onSubmit(data: GeneralSettingsFormValues) {
    if (isPersonalTeam) return;

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
          variables: currentTeamTheme?.variables ?? {},
        },
      },
    });
    form.reset(data);
    toast.success("Team settings updated successfully");
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
                            const { success, error } =
                              await deleteTeam.mutateAsync(
                                typeof currentTeamId === "number"
                                  ? currentTeamId
                                  : Number(currentTeamId) || 0,
                              );
                            if (!success) {
                              throw new Error(error);
                            }
                            // Do not close the dialog automatically
                            globalThis.location.href = "/";
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
