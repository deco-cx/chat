import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod/v3";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";

// Schema based on ResourceCreateInputSchema from packages/runtime/src/resources.ts
const ResourceCreateFormSchema = z.object({
  resourceName: z
    .string()
    .min(1, "Resource name is required")
    .regex(
      /^[a-zA-Z0-9-_]+$/,
      "Resource name can only contain letters, numbers, hyphens, and underscores",
    ),
  title: z.string().optional(),
  description: z.string().optional(),
  content: z
    .string()
    .min(1, "Content is required")
    .describe("The text content for the resource"),
});

type ResourceCreateFormData = z.infer<typeof ResourceCreateFormSchema>;

interface ResourceCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceName: string;
  onSubmit: (data: {
    resourceName: string;
    title?: string;
    description?: string;
    content: { data: string; type: "text" };
  }) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  onClearError?: () => void;
}

export function ResourceCreateDialog({
  open,
  onOpenChange,
  resourceName,
  onSubmit,
  isLoading = false,
  error,
  onClearError,
}: ResourceCreateDialogProps) {
  const form = useForm<ResourceCreateFormData>({
    resolver: zodResolver(ResourceCreateFormSchema),
    defaultValues: {
      resourceName: "",
      title: "",
      description: "",
      content: "",
    },
    mode: "onBlur",
  });

  const handleSubmit = async (data: ResourceCreateFormData) => {
    // Clear any previous errors when submitting
    onClearError?.();

    try {
      await onSubmit({
        resourceName: data.resourceName,
        title: data.title || undefined,
        description: data.description || undefined,
        content: {
          data: data.content,
          type: "text",
        },
      });
      // Only reset and close on success (handled in parent component)
      form.reset();
    } catch (error) {
      // Error handling is done in the parent component
      console.error("Failed to create resource:", error);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isLoading) {
      form.reset();
      onClearError?.(); // Clear errors when closing dialog
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create {resourceName}</DialogTitle>
          <DialogDescription>
            Create a new {resourceName.toLowerCase()} resource. All fields
            except the resource name and content are optional.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="resourceName"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>
                    Resource Name{" "}
                    <span className="text-destructive ml-1">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="my-resource-name"
                      className={
                        fieldState.error
                          ? "border-destructive focus-visible:ring-destructive"
                          : ""
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Display title for the resource"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Optional description of the resource"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>
                    Content <span className="text-destructive ml-1">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Enter the text content for this resource"
                      rows={6}
                      className={
                        fieldState.error
                          ? "border-destructive focus-visible:ring-destructive"
                          : ""
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Spinner size="xs" />
                    <span className="ml-2">Creating...</span>
                  </>
                ) : (
                  "Create Resource"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
