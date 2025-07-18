import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

export interface ViewModeSwitcherProps {
  viewMode: "cards" | "table";
  onChange: (mode: "cards" | "table") => void;
}

export function ViewModeSwitcher({
  viewMode,
  onChange,
}: ViewModeSwitcherProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant={viewMode === "cards" ? "secondary" : "ghost"}
        size="icon"
        aria-label="Card view"
        onClick={() => onChange("cards")}
        className={viewMode === "cards" ? "bg-muted" : ""}
      >
        <Icon
          name="grid_view"
          size={16}
          className={
            viewMode === "cards" ? "text-foreground" : "text-muted-foreground"
          }
        />
      </Button>
      <Button
        variant={viewMode === "table" ? "secondary" : "ghost"}
        size="icon"
        aria-label="Table view"
        onClick={() => onChange("table")}
        className={viewMode === "table" ? "bg-muted" : ""}
      >
        <Icon
          name="menu"
          size={16}
          className={
            viewMode === "table" ? "text-foreground" : "text-muted-foreground"
          }
        />
      </Button>
    </div>
  );
}
