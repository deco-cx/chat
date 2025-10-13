import { type NodeProps, Handle, Position } from "reactflow";
import { Icon } from "@deco/ui/components/icon.tsx";

export function PlusButtonNode({ data }: NodeProps) {
  const { onClick } = data as { onClick: () => void };

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-12 h-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-all hover:scale-110 shadow-lg border-2 border-background nodrag"
      >
        <Icon name="add" size={24} />
      </button>
    </>
  );
}
