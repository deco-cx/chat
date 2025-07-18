import type { ListTriggersOutput } from "@deco/sdk";
import { useDeleteTrigger } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "@deco/ui/components/dialog.tsx";

export const DeleteTriggerModal = ({
  trigger,
  open,
  onOpenChange,
}: {
  trigger: ListTriggersOutput["triggers"][number];

  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { mutate: deleteTrigger } = useDeleteTrigger();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>Delete Trigger</DialogHeader>
        <DialogDescription>
          Are you sure you want to delete this trigger?
        </DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              deleteTrigger(trigger.id);
              onOpenChange(false);
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
