import type { TriggerOutput } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useState } from "react";
import { DeleteTriggerModal } from "./delete-trigger-dialog.tsx";
import { TriggerModal } from "./trigger-dialog.tsx";

interface TriggerActionsProps {
  trigger: TriggerOutput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TriggerActions({
  trigger,
  open,
  onOpenChange,
}: TriggerActionsProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  return (
    <>
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
            onClick={(e) => {
              e.stopPropagation();
              setIsEditModalOpen(true);
            }}
          >
            <Icon name="edit" className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChange(true);
            }}
          >
            <Icon name="delete" className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteTriggerModal
        trigger={trigger}
        open={open}
        onOpenChange={onOpenChange}
      />
      {isEditModalOpen && (
        <TriggerModal
          trigger={trigger}
          isOpen={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
        />
      )}
    </>
  );
}
