import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

interface GenerateOutputViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (purpose: string) => void;
  isLoading?: boolean;
}

export function GenerateOutputViewModal({
  open,
  onOpenChange,
  onGenerate,
  isLoading,
}: GenerateOutputViewModalProps) {
  const [purpose, setPurpose] = useState("");

  function handleGenerate() {
    if (!purpose.trim()) return;
    onGenerate(purpose.trim());
    setPurpose(""); // Reset for next time
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Generate Custom Output View</DialogTitle>
          <DialogDescription>
            Describe how you want the output to be displayed. The AI will
            generate a custom view that matches your requirements.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="purpose">View Purpose</Label>
            <Textarea
              id="purpose"
              placeholder="e.g., Show the poem in a large, beautiful format with a copy button"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={4}
              disabled={isLoading}
              className="resize-none"
            />
            <p className="text-sm text-muted-foreground">
              Example: "Display the results as a table with color-coded scores"
              or "Show the text in a card with a copy button"
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={!purpose.trim() || isLoading}
            className="bg-primary-light text-primary-dark hover:bg-[#c5e015]"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-primary-dark/20 border-t-primary-dark rounded-full animate-spin mr-2" />
                Generating...
              </>
            ) : (
              <>
                <Icon name="auto_awesome" size={16} className="mr-2" />
                Generate View
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
