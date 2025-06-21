import { type Space } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@deco/ui/components/dialog.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useState } from "react";

interface SpaceSelectorProps {
  spaces: Record<string, Space>;
  currentSpace: string;
  onSpaceChange: (spaceId: string) => void;
  onSaveSpace: (spaceId: string, spaceName: string) => void;
  onDeleteSpace?: (spaceId: string) => void;
  className?: string;
}

export function SpaceSelector({
  spaces,
  currentSpace,
  onSpaceChange,
  onSaveSpace,
  onDeleteSpace,
  className,
}: SpaceSelectorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");

  const currentSpaceData = spaces[currentSpace];
  const spaceEntries = Object.entries(spaces);

  const handleSaveNewSpace = () => {
    if (newSpaceName.trim()) {
      const spaceId = newSpaceName.toLowerCase().replace(/\s+/g, "-");
      onSaveSpace(spaceId, newSpaceName.trim());
      setNewSpaceName("");
      setIsDialogOpen(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-between min-w-[120px]",
              className,
            )}
          >
            <span className="flex items-center gap-2">
              <Icon name="view_kanban" size={16} />
              {currentSpaceData?.title || "Space"}
            </span>
            <Icon name="expand_more" className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[200px]">
          <div className="p-2">
            <Label className="text-xs font-medium text-muted-foreground">
              SPACES
            </Label>
          </div>
          {spaceEntries.map(([spaceId, space]) => (
            <DropdownMenuItem
              key={spaceId}
              onClick={() => onSpaceChange(spaceId)}
              className={cn(
                "flex items-center justify-between cursor-pointer",
                currentSpace === spaceId && "bg-accent",
              )}
            >
              <span className="flex items-center gap-2">
                <Icon name="view_kanban" size={14} />
                {space.title}
              </span>
              {currentSpace === spaceId && (
                <Icon name="check" size={14} className="text-accent-foreground" />
              )}
            </DropdownMenuItem>
          ))}
          {spaceEntries.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem
            onClick={() => setIsDialogOpen(true)}
            className="cursor-pointer"
          >
            <Icon name="add" size={14} className="mr-2" />
            Save as new space
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Save New Space</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="space-name" className="text-right">
                Name
              </Label>
              <Input
                id="space-name"
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                placeholder="Enter space name"
                className="col-span-3"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveNewSpace();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveNewSpace}
              disabled={!newSpaceName.trim()}
            >
              Save Space
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}