import { useRemoveIntegration } from "@deco/sdk";
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
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { type MouseEvent, useState } from "react";
import { trackEvent } from "../../hooks/analytics.ts";

export function useRemoveConnection() {
  const { mutateAsync: removeIntegration, isPending } = useRemoveIntegration();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const performDelete = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    if (!deletingId) return;

    try {
      await removeIntegration(deletingId);

      trackEvent("integration_delete", {
        success: true,
        data: deletingId,
      });
    } catch (error) {
      console.error("Error deleting integration:", error);

      trackEvent("integration_delete", {
        success: false,
        data: deletingId,
        error,
      });
    } finally {
      setDeletingId(null);
    }
  };

  return {
    deletingId,
    setDeletingId,
    performDelete,
    isDeletionPending: isPending,
  };
}

export function RemoveConnectionAlert({
  open,
  onOpenChange,
  onDelete,
  isDeleting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (e: React.MouseEvent<HTMLButtonElement>) => void;
  isDeleting: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the integration. This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
          >
            {isDeleting ? (
              <>
                <Spinner />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
