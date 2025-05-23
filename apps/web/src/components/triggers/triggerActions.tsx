import { TriggerOutputSchema } from "@deco/sdk";
import { z } from "zod";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { DeleteTriggerModal } from "./deleteTriggerModal.tsx";
import { TriggerModal } from "./triggerModal.tsx";
import { useState } from "react";

interface TriggerActionsProps {
  trigger: z.infer<typeof TriggerOutputSchema>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TriggerActions(
  { trigger, open, onOpenChange }: TriggerActionsProps,
) {
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
            className="text-red-500"
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
        agentId={trigger.agent?.id || ""}
        open={open}
        onOpenChange={onOpenChange}
      />
      <TriggerModal
        trigger={trigger}
        isOpen={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
      />
    </>
  );
}
