import { Input } from "@deco/ui/components/input.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { useRef } from "react";

interface ColorPickerProps {
  value: string;
  defaultValue: string;
  isDefault: boolean;
  onChange: (value: string) => void;
  onReset: () => void;
}

function parseColorToHex(color: string): string {
  if (!color) return "#cccccc";
  if (color.startsWith("#")) return color;

  // For OKLCH colors, we'll just show a preview swatch with the computed style
  // The browser will render the OKLCH color correctly when applied to the element
  return "#cccccc";
}

export function ColorPicker({
  value,
  defaultValue,
  isDefault,
  onChange,
  onReset,
}: ColorPickerProps) {
  const displayValue = value || defaultValue;
  const hexColor = parseColorToHex(displayValue);
  const isHexColor = displayValue.startsWith("#");
  const colorInputRef = useRef<HTMLInputElement>(null);

  const handleCardClick = () => {
    colorInputRef.current?.click();
  };

  return (
    <div className="relative group">
      {/* Full background color card - clickable */}
      <div
        onClick={handleCardClick}
        className="h-32 rounded-lg border-2 border-border shadow-sm cursor-pointer transition-all hover:border-primary/50 hover:shadow-md overflow-hidden"
        style={{
          backgroundColor: displayValue,
        }}
        title={displayValue}
      >
        {/* Gradient overlay for better text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Bottom input overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-xs bg-background/95 backdrop-blur-sm border-border/50 shadow-lg"
            placeholder={defaultValue || "Using default theme"}
          />
        </div>

        {/* Hidden color picker input */}
        <input
          ref={colorInputRef}
          type="color"
          value={isHexColor ? displayValue : hexColor}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          className="absolute opacity-0 pointer-events-none"
        />

        {/* Reset button - top right */}
        {!isDefault && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReset();
                  }}
                  className="absolute top-2 right-2 h-6 w-6 rounded-md bg-background/95 backdrop-blur-sm border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-all shadow-sm opacity-0 group-hover:opacity-100"
                >
                  <Icon name="close" size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reset to default</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
