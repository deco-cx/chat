import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import type { ComponentProps } from "react";

export function EmptyState({
  icon,
  title,
  description,
  buttonProps,
}: {
  icon: string;
  title: string;
  description: string;
  buttonProps: ComponentProps<typeof Button>;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 relative">
      <div className="flex items-center justify-center -mb-16">
        <div className="p-6 rounded-full border border-slate-50">
          <div className="p-4 rounded-full border border-slate-100">
            <div className="p-3.5 rounded-full border border-slate-100">
              <div className="p-3 rounded-full border border-slate-100">
                <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center p-4">
                  <Icon name={icon} className="text-slate-300" size={36} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 w-72">
        <h3 className="text-lg font-semibold text-gray-900 text-center">
          {title}
        </h3>
        <p className="text-sm text-gray-500 text-center">
          {description}
        </p>
      </div>
      <Button
        variant="default"
        size="default"
        className={cn("gap-2", buttonProps?.className)}
        {...buttonProps}
      />
    </div>
  );
}
