import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { Integration } from "@deco/sdk";
import { IntegrationIcon } from "../../integrations/list/common.tsx";

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface MentionListProps {
  items: Integration[];
  command: (item: Integration) => void;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) {
        command(item);
      }
    };

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((selectedIndex + items.length - 1) % items.length);
          return true;
        }

        if (event.key === "ArrowDown") {
          setSelectedIndex((selectedIndex + 1) % items.length);
          return true;
        }

        if (event.key === "Enter") {
          selectItem(selectedIndex);
          event.preventDefault();
          event.stopPropagation();
          return true;
        }

        return false;
      },
    }));

    return (
      <div className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
        <div className="max-h-[300px] overflow-y-auto p-1">
          {items.length
            ? (
              items.map((item, index) => (
                <button
                  className={`flex items-center gap-2 w-full p-2 text-left rounded-md text-sm ${
                    index === selectedIndex
                      ? "bg-slate-100"
                      : "hover:bg-slate-50"
                  }`}
                  key={item.id}
                  onClick={() => selectItem(index)}
                >
                  <div className="w-8 h-8 flex-shrink-0">
                    <IntegrationIcon
                      icon={item.icon}
                      name={item.name}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{item.name}</span>
                    {item.description && (
                      <span className="text-xs text-slate-500 truncate">
                        {item.description}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )
            : (
              <div className="p-2 text-sm text-slate-500">
                No integrations found
              </div>
            )}
        </div>
      </div>
    );
  },
);
