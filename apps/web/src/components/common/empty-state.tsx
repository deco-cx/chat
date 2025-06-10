import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import type { ComponentProps, ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  buttonProps = {},
  buttonComponent,
}: {
  icon: string;
  title: string;
  description: string | ReactNode;
  buttonProps?: ComponentProps<typeof Button>;
  buttonComponent?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 relative">
      <div className="absolute flex items-center justify-center mb-80">
        <div className="p-6 rounded-full border border-muted">
          <div className="p-4 rounded-full border border-border">
            <div className="p-3.5 rounded-full border border-border">
              <div className="p-3 rounded-full border border-border">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center p-4">
                  <Icon
                    name={icon}
                    className="text-muted-foreground"
                    size={36}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 max-w-md z-10">
        <h3 className="text-2xl font-semibold text-foreground text-center">
          {title}
        </h3>
        <div className="text-sm text-muted-foreground text-center flex flex-col gap-1">
          {description}
        </div>
      </div>
      {buttonComponent ?? (
        <Button
          variant="outline"
          size="default"
          className={cn("gap-2", buttonProps?.className)}
          {...buttonProps}
        />
      )}
    </div>
  );
}
