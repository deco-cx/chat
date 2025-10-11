import { cn } from "@deco/ui/lib/utils.ts";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useEffect, useRef } from "react";

export interface StepPreview {
  id: string;
  name: string;
  thumbnail?: string;
  icon?: string;
}

export interface WorkflowStepsPreviewProps {
  steps: StepPreview[];
  activeStepId?: string;
  onStepClick?: (stepId: string) => void;
  onAddStep?: () => void;
  className?: string;
}

export function WorkflowStepsPreview({
  steps,
  activeStepId,
  onStepClick,
  onAddStep,
  className,
}: WorkflowStepsPreviewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeStepRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll to active step
  useEffect(() => {
    if (activeStepRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const activeStep = activeStepRef.current;

      const containerRect = container.getBoundingClientRect();
      const stepRect = activeStep.getBoundingClientRect();

      const scrollLeft =
        stepRect.left -
        containerRect.left +
        container.scrollLeft -
        containerRect.width / 2 +
        stepRect.width / 2;

      container.scrollTo({
        left: scrollLeft,
        behavior: "smooth",
      });
    }
  }, [activeStepId]);

  return (
    <div className="flex items-center gap-0.5">
      <div
        ref={scrollContainerRef}
        className={cn(
          "flex gap-1 items-center overflow-x-auto px-2 py-0 max-w-[252px]",
          "scrollbar-none",
          className,
        )}
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {steps.map((step) => {
          const isActive = step.id === activeStepId;

          return (
            <button
              key={step.id}
              ref={isActive ? activeStepRef : null}
              type="button"
              onClick={() => onStepClick?.(step.id)}
              aria-label={`Go to step: ${step.name}`}
              className={cn(
                "relative rounded-md shrink-0 size-9 border transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive
                  ? "border-[var(--primary-light)] opacity-100"
                  : "border-border opacity-50 hover:opacity-75",
              )}
            >
              {step.thumbnail ? (
                <img
                  src={step.thumbnail}
                  alt={step.name}
                  className="absolute inset-0 size-full object-cover object-center pointer-events-none rounded-md"
                />
              ) : step.icon ? (
                <div className="absolute inset-0 size-full bg-muted rounded-md flex items-center justify-center">
                  <Icon
                    name={step.icon}
                    size={20}
                    className="text-muted-foreground"
                  />
                </div>
              ) : (
                <div className="absolute inset-0 size-full bg-muted rounded-md" />
              )}
            </button>
          );
        })}
      </div>

      {onAddStep && (
        <button
          type="button"
          onClick={onAddStep}
          aria-label="Add new step"
          className="flex items-center justify-center rounded-xl shrink-0 size-8 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Icon name="add" size={20} className="text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
