import { Button } from "@deco/ui/components/button.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import type { ComponentProps, InputHTMLAttributes, ReactNode } from "react";
import { ViewModeSwitcher } from "./view-mode-switcher.tsx";

interface Props {
  filter?: {
    items: Chiplet[];
    onClick: (item: Chiplet) => void;
  };
  input?: InputHTMLAttributes<HTMLInputElement>;
  view?: ComponentProps<typeof ViewModeSwitcher>;
}

interface Chiplet {
  id: string;
  active?: boolean;
  label: string | ReactNode;
  count: number;
  disabled?: boolean;
  tooltip?: string;
}

interface ChipletProps {
  item: Chiplet;
  onClick: (item: Chiplet) => void;
}

export function Chiplet(props: ChipletProps) {
  const { item, onClick } = props;

  return (
    <Tooltip>
      <TooltipTrigger>
        <Button
          variant="outline"
          disabled={item.disabled}
          className={cn(
            "shadow-none items-center gap-2",
            item.active && "bg-accent",
          )}
          onClick={() => onClick(item)}
          type="button"
        >
          {item.label}
          <span className="text-xs text-muted-foreground">{item.count}</span>
        </Button>
      </TooltipTrigger>
      {item.tooltip && (
        <TooltipContent side="bottom">{item.tooltip}</TooltipContent>
      )}
    </Tooltip>
  );
}

export function ListPageHeader({ filter, input, view }: Props) {
  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-2">
      <div className="flex items-center gap-2">
        {filter?.items.map((chiplet) => (
          <Chiplet key={chiplet.id} item={chiplet} onClick={filter.onClick} />
        ))}
      </div>
      <div className="flex items-center gap-2 justify-self-auto md:justify-self-end p-1">
        {view && <ViewModeSwitcher {...view} />}
        {input && <Input className="w-80 text-sm" {...input} />}
      </div>
    </div>
  );
}
