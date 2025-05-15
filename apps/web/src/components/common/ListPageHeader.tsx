import { Button } from "@deco/ui/components/button.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import type { ComponentProps, InputHTMLAttributes, ReactNode } from "react";
import { ViewModeSwitcher } from "./ViewModelSwitcher.tsx";

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
}

interface ChipletProps {
  item: Chiplet;
  onClick: (item: Chiplet) => void;
}

function Chiplet(props: ChipletProps) {
  const { item, onClick } = props;

  return (
    <Button
      variant={item.active ? "secondary" : "outline"}
      className="shadow-none items-center gap-2"
      onClick={() => onClick(item)}
    >
      {item.label}
      <span className="text-xs text-slate-400">
        {item.count}
      </span>
    </Button>
  );
}

export function ListPageHeader({ filter, input, view }: Props) {
  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-2">
      <div className="flex items-center gap-2">
        {filter?.items.map((chiplet) => (
          <Chiplet
            key={chiplet.id}
            item={chiplet}
            onClick={filter.onClick}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 justify-self-auto md:justify-self-end p-1">
        {view && <ViewModeSwitcher {...view} />}
        {input && <Input className="w-80 text-sm" {...input} />}
      </div>
    </div>
  );
}
