import { useCreateTeam } from "@deco/sdk";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

// Simple slugify function for client-side use
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]+/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const createOrgSchema = z.object({
  name: z.string().min(2, "Team name is required"),
});

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
}: CreateOrganizationDialogProps) {
  const createTeam = useCreateTeam();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof createOrgSchema>>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      name: "",
    },
    mode: "onChange",
  });

  // Compute slug from name
  const nameValue = form.watch("name");
  const slug = slugify(nameValue || "");

  async function onSubmit(data: z.infer<typeof createOrgSchema>) {
    setError(null);
    try {
      const result = await createTeam.mutateAsync({
        name: data.name,
        slug,
      });
      if (result?.slug) {
        globalThis.location.href = `/${result.slug}`;
      }
    } catch (err) {
      setError(
        typeof err === "string"
          ? err
          : err instanceof Error
            ? err.message
            : "Failed to create team.",
      );
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Create a new organization</AlertDialogTitle>
          <AlertDialogDescription>
            Set up a new organization to collaborate with others.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Form {...form}>
          <form
            className="space-y-6"
            onSubmit={form.handleSubmit(onSubmit)}
            autoComplete="off"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Acme Inc."
                      disabled={createTeam.isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    The name of your company or organization
                  </FormDescription>
                  {/* Slug preview */}
                  {slug && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Organization URL:{" "}
                      <span className="font-mono">
                        {typeof window !== "undefined"
                          ? globalThis.location.origin
                          : ""}
                        /{slug}
                      </span>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && (
              <div className="text-destructive text-sm mt-2">{error}</div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={createTeam.isPending}>
                Cancel
              </AlertDialogCancel>
              <Button
                type="submit"
                variant="default"
                disabled={
                  !form.formState.isValid || createTeam.isPending || !slug
                }
              >
                {createTeam.isPending ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="xs" /> Creating...
                  </span>
                ) : (
                  "Create Organization"
                )}
              </Button>
            </AlertDialogFooter>
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
