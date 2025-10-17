import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import {
  ResponsiveSelect,
  ResponsiveSelectContent,
  ResponsiveSelectItem,
  ResponsiveSelectTrigger,
  ResponsiveSelectValue,
} from "@deco/ui/components/responsive-select.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  DEFAULT_MODEL,
  type Model,
  useModels,
  WELL_KNOWN_MODELS,
} from "@deco/sdk";
import { memo, useMemo, useState } from "react";

const mapLegacyModelId = (modelId: string): string => {
  const model = WELL_KNOWN_MODELS.find((m) => m.legacyId === modelId);
  return model ? model.id : modelId;
};

const CAPABILITY_CONFIGS = {
  reasoning: {
    icon: "neurology",
    bg: "bg-purple-100",
    text: "text-purple-700",
    label: "Reasoning",
  },
  "image-upload": {
    icon: "image",
    bg: "bg-teal-100",
    text: "text-teal-700",
    label: "Can analyze images",
  },
  "file-upload": {
    icon: "description",
    bg: "bg-blue-100",
    text: "text-blue-700",
    label: "Can analyze files",
  },
  "web-search": {
    icon: "search",
    bg: "bg-amber-100",
    text: "text-amber-700",
    label: "Can search the web to answer questions",
  },
} as const;

const CapabilityBadge = memo(function CapabilityBadge({
  capability,
}: {
  capability: keyof typeof CAPABILITY_CONFIGS;
}) {
  const config = useMemo(() => {
    return (
      CAPABILITY_CONFIGS[capability] || {
        icon: "check" as const,
        bg: "bg-slate-200" as const,
        text: "text-slate-700" as const,
        label: capability,
      }
    );
  }, [capability]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`flex items-center justify-center h-6 w-6 rounded-sm ${config.bg}`}
        >
          <Icon name={config.icon} className={config.text} />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{config.label}</p>
      </TooltipContent>
    </Tooltip>
  );
});

const ModelItemContent = memo(function ModelItemContent({
  model,
}: {
  model: Model;
}) {
  return (
    <div className="p-2 md:w-[400px] flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <img src={model.logo} className="w-5 h-5" />
        <span className="text-normal text-foreground">{model.name}</span>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        {model.capabilities.map((capability) => (
          <CapabilityBadge key={capability} capability={capability} />
        ))}
      </div>
    </div>
  );
});

function SelectedModelDisplay({
  model,
}: {
  model: (typeof WELL_KNOWN_MODELS)[0];
}) {
  return (
    <div className="flex items-center gap-2">
      {model.logo && <img src={model.logo} className="w-4 h-4" />}
      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
        {model.name}
      </span>
    </div>
  );
}

interface ModelSelectorProps {
  model?: string;
  onModelChange?: (model: string) => void;
  variant?: "borderless" | "bordered";
  className?: string;
}

export function ModelSelector({
  model = DEFAULT_MODEL.id,
  onModelChange,
  variant = "borderless",
  className,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const { data: models } = useModels({ excludeDisabled: true });
  const selectedModel = models.find((m) => m.id === model) || DEFAULT_MODEL;

  const handleModelChange = (model: string) => {
    if (onModelChange) {
      onModelChange(model);
      setOpen(false);
    }
  };

  return (
    <ResponsiveSelect
      open={open}
      onOpenChange={setOpen}
      value={mapLegacyModelId(model)}
      onValueChange={(value) => handleModelChange(value)}
    >
      <ResponsiveSelectTrigger
        className={cn(
          "!h-8 text-sm hover:bg-accent rounded-xl py-1 px-2 gap-1 shadow-none cursor-pointer border-0 group",
          variant === "borderless" && "md:border-none",
          className,
        )}
      >
        <ResponsiveSelectValue placeholder="Select model">
          <SelectedModelDisplay model={selectedModel} />
        </ResponsiveSelectValue>
      </ResponsiveSelectTrigger>
      <ResponsiveSelectContent title="Select model">
        {models.map((model) => (
          <ResponsiveSelectItem
            key={model.id}
            value={model.id}
            hideCheck
            className={cn(
              "p-0 focus:bg-muted text-foreground focus:text-foreground cursor-pointer",
              model.id === selectedModel?.id && "bg-muted/50",
            )}
          >
            <ModelItemContent model={model} />
          </ResponsiveSelectItem>
        ))}
      </ResponsiveSelectContent>
    </ResponsiveSelect>
  );
}
