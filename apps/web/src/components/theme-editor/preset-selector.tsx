import { Button } from "@deco/ui/components/button.tsx";
import { THEME_PRESETS, type ThemePreset } from "./theme-presets.ts";
import { cn } from "@deco/ui/lib/utils.ts";

interface PresetSelectorProps {
  onSelectPreset: (preset: ThemePreset) => void;
  selectedPresetId?: string;
}

export function PresetSelector({
  onSelectPreset,
  selectedPresetId,
}: PresetSelectorProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">Theme Presets</h3>
        <p className="text-xs text-muted-foreground">
          Apply theme presets with a single click
        </p>
      </div>

      <div className="overflow-x-auto pb-2 -mx-4 px-4">
        <div className="flex gap-2 min-w-max">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset)}
              className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:border-primary/50 hover:bg-accent/5 min-w-[120px]",
                selectedPresetId === preset.id && "border-primary bg-primary/5",
              )}
            >
              <div className="flex gap-1.5">
                {preset.colors.map((color, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-full border border-border/50 shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <span className="text-xs font-medium text-center leading-tight whitespace-nowrap">
                {preset.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
