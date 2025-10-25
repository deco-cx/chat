import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  DEFAULT_THEME,
  THEME_VARIABLES,
  type ThemeVariable,
  useOrgTheme,
  useUpdateOrgTheme,
  type Theme,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { Form } from "@deco/ui/components/form.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";
import { ThemePreview } from "./theme-preview.tsx";
import { ColorPicker } from "./color-picker.tsx";
import { useSetThreadContextEffect } from "../decopilot/thread-context-provider.tsx";
import { PresetSelector } from "./preset-selector.tsx";
import type { ThemePreset } from "./theme-presets.ts";

interface ThemeEditorFormValues {
  themeVariables: Record<string, string | undefined>;
}

const themeEditorSchema = z.object({
  themeVariables: z.record(z.string(), z.string().optional()),
});

interface ThemeVariableInputProps {
  variable: {
    key: ThemeVariable;
    value: string;
    isDefault: boolean;
    defaultValue: string;
  };
  onChange: (value: string) => void;
}

function ThemeVariableInput({ variable, onChange }: ThemeVariableInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <ColorPicker
        value={variable.value}
        defaultValue={variable.defaultValue}
        isDefault={variable.isDefault}
        onChange={onChange}
        onReset={() => onChange("")}
      />
      <div className="flex items-center justify-between gap-1">
        <div className="text-xs font-medium capitalize leading-tight">
          {variable.key.replace("--", "").replace(/-/g, " ")}
        </div>
        {variable.isDefault && (
          <div className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium shrink-0">
            Default
          </div>
        )}
      </div>
    </div>
  );
}

interface ThemeFormProps {
  colorGroups: Array<{
    name: string;
    variables: Array<{
      key: ThemeVariable;
      value: string;
      isDefault: boolean;
      defaultValue: string;
    }>;
  }>;
  handleVariableChange: (key: ThemeVariable, value: string) => void;
  onSubmit: (data: ThemeEditorFormValues) => Promise<void>;
  isUpdating: boolean;
  form: ReturnType<typeof useForm<ThemeEditorFormValues>>;
  saveButtonText: string;
  extraActions?: React.ReactNode;
}

function ThemeForm({
  colorGroups,
  handleVariableChange,
  onSubmit,
  isUpdating,
  form,
  saveButtonText,
  extraActions,
}: ThemeFormProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {colorGroups.map((group) => (
          <div key={group.name} className="space-y-4">
            <div className="flex items-center gap-2 pb-1 px-4">
              <h3 className="text-lg font-semibold text-foreground">
                {group.name}
              </h3>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-6 gap-3 px-4">
              {group.variables.map((variable) => (
                <ThemeVariableInput
                  key={variable.key}
                  variable={variable}
                  onChange={(value) =>
                    handleVariableChange(variable.key, value)
                  }
                />
              ))}
            </div>
          </div>
        ))}
        {extraActions && (
          <div className="flex gap-3 pt-4 border-t px-4">{extraActions}</div>
        )}
      </form>
    </Form>
  );
}

export function ThemeEditorView() {
  const team = useCurrentTeam();
  const [selectedPresetId, setSelectedPresetId] = useState<string>();

  // Fetch org theme
  const orgId = typeof team?.id === "number" ? team.id : undefined;
  const { data: orgTheme, isLoading } = useOrgTheme(orgId);

  // Mutation
  const updateOrgThemeMutation = useUpdateOrgTheme();

  const currentTheme = orgTheme;
  const isUpdating = updateOrgThemeMutation.isPending;

  const form = useForm<ThemeEditorFormValues>({
    resolver: zodResolver(themeEditorSchema),
    defaultValues: {
      themeVariables: currentTheme?.variables ?? {},
    },
  });

  // Update form when theme changes
  useEffect(() => {
    form.reset({
      themeVariables: currentTheme?.variables ?? {},
    });
  }, [currentTheme, form]);

  const variables = useMemo(() => {
    const formValues = form.watch("themeVariables");
    return THEME_VARIABLES.map((key) => ({
      key,
      value: String(formValues[key] || ""),
      isDefault: !formValues[key],
      defaultValue: DEFAULT_THEME.variables?.[key] || "",
    }));
  }, [form.watch("themeVariables")]);

  // Organize variables into semantic groups - prioritized by importance
  const colorGroups = useMemo(() => {
    const groupMap: Record<string, ThemeVariable[]> = {
      "Brand Colors": [
        "--primary",
        "--primary-foreground",
        "--primary-light",
        "--primary-dark",
        "--background",
        "--foreground",
      ],
      "Interactive Elements": [
        "--accent",
        "--accent-foreground",
        "--secondary",
        "--secondary-foreground",
      ],
      "Cards & Surfaces": [
        "--card",
        "--card-foreground",
        "--border",
        "--input",
      ],
      "Feedback Colors": [
        "--destructive",
        "--destructive-foreground",
        "--success",
        "--success-foreground",
        "--warning",
        "--warning-foreground",
      ],
      Sidebar: [
        "--sidebar",
        "--sidebar-foreground",
        "--sidebar-accent",
        "--sidebar-accent-foreground",
        "--sidebar-border",
        "--sidebar-ring",
      ],
      Advanced: [
        "--popover",
        "--popover-foreground",
        "--muted",
        "--muted-foreground",
        "--splash",
      ],
    };

    return Object.entries(groupMap).map(([groupName, keys]) => ({
      name: groupName,
      variables: variables.filter((v) => keys.includes(v.key)),
    }));
  }, [variables]);

  // Thread context for AI assistance with theme editing
  const threadContextItems = useMemo<
    Array<
      | { id: string; type: "rule"; text: string }
      | {
          id: string;
          type: "toolset";
          integrationId: string;
          enabledTools: string[];
        }
    >
  >(() => {
    const rules = [
      `You are helping the user customize their organization workspace theme. The Theme Editor allows editing organization-level themes that apply to all projects.`,
      `Available theme variables and their purposes:
- Brand Colors: Primary brand color (--primary), its foreground text (--primary-foreground), and variants (--primary-light, --primary-dark) for gradients and emphasis
- Base Colors: Main background (--background) and text color (--foreground) - the foundation of the entire theme
- Interactive Elements: Secondary actions (--secondary), accent highlights (--accent), and their respective text colors
- Cards & Surfaces: Card backgrounds (--card), borders (--border), and input field borders (--input)
- Feedback Colors: Destructive/error (--destructive), success (--success), warning (--warning) states with their text colors
- Sidebar: All sidebar-related colors including background, text, accent, borders, and focus rings
- Advanced: Popovers, muted text, and splash screen colors`,
      `Colors should be in OKLCH format (preferred) like "oklch(0.5 0.2 180)" or hex format like "#ff0000". OKLCH provides better color manipulation and perception.`,
      `Use THEME_UPDATE_ORG to update the organization-level theme. Do NOT pass orgId - it will be automatically determined from the current workspace context.`,
      `To update a theme, only pass the "theme" parameter with the variables you want to change. Example: { "theme": { "variables": { "--primary": "oklch(0.65 0.18 200)" } } }`,
      `When suggesting theme changes, consider: contrast ratios for accessibility, color harmony, and the relationship between background/foreground pairs.`,
    ];

    const contextItems: Array<
      | { id: string; type: "rule"; text: string }
      | {
          id: string;
          type: "toolset";
          integrationId: string;
          enabledTools: string[];
        }
    > = rules.map((text) => ({
      id: crypto.randomUUID(),
      type: "rule" as const,
      text,
    }));

    // Add theme management toolset
    contextItems.push({
      id: crypto.randomUUID(),
      type: "toolset" as const,
      integrationId: "i:theme-management",
      enabledTools: ["THEME_GET_ORG", "THEME_UPDATE_ORG"],
    });

    // Add HTTP Fetch tool for fetching inspiration/color palettes
    contextItems.push({
      id: crypto.randomUUID(),
      type: "toolset" as const,
      integrationId: "i:http",
      enabledTools: ["HTTP_FETCH"],
    });

    return contextItems;
  }, []);

  useSetThreadContextEffect(threadContextItems);

  const hasChanges = useMemo(() => {
    const formValues = form.watch("themeVariables");
    const currentValues = currentTheme?.variables || {};
    return JSON.stringify(formValues) !== JSON.stringify(currentValues);
  }, [form.watch("themeVariables"), currentTheme]);

  // Debounce timer ref
  const debounceTimerRef = useRef<number | undefined>(undefined);

  const handleVariableChange = useCallback(
    (key: ThemeVariable, newValue: string) => {
      // Immediately apply to CSS for instant visual feedback
      if (newValue) {
        document.documentElement.style.setProperty(key, newValue);
      } else {
        const defaultValue = DEFAULT_THEME.variables?.[key];
        if (defaultValue) {
          document.documentElement.style.setProperty(key, defaultValue);
        }
      }

      // Debounce the form update to reduce re-renders
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = window.setTimeout(() => {
        const currentValues = form.getValues("themeVariables");
        const updatedValues = {
          ...currentValues,
          [key]: newValue || undefined,
        };
        form.setValue("themeVariables", updatedValues, { shouldDirty: true });
      }, 100);
    },
    [form],
  );

  async function onSubmit(data: ThemeEditorFormValues) {
    try {
      if (!orgId) {
        toast.error("No organization selected");
        return;
      }

      const theme: Theme = {
        variables: data.themeVariables as Record<ThemeVariable, string>,
      };

      await updateOrgThemeMutation.mutateAsync({ orgId, theme });
      toast.success("Organization theme updated successfully");

      // Dispatch custom event for immediate UI update
      window.dispatchEvent(new CustomEvent("theme-updated"));
    } catch (error) {
      console.error("Failed to update theme:", error);
      toast.error("Failed to update theme");
    }
  }

  function handleSelectPreset(preset: ThemePreset) {
    setSelectedPresetId(preset.id);

    // Apply preset to form
    const presetVariables = preset.theme.variables || {};

    // Derive brand variants if missing to match our schema
    const defaultPrimaryLight =
      DEFAULT_THEME.variables?.["--primary-light"] || "#d0ec1a";
    const defaultPrimaryDark =
      DEFAULT_THEME.variables?.["--primary-dark"] || "#07401a";

    function clamp(value: number, min: number, max: number): number {
      return Math.max(min, Math.min(max, value));
    }

    function toHex(n: number): string {
      const clamped = clamp(Math.round(n), 0, 255);
      return clamped.toString(16).padStart(2, "0");
    }

    function adjustHexTowards(hex: string, target: 0 | 255, t: number): string {
      const clean = hex.replace("#", "");
      if (clean.length !== 6) return hex;
      const r = parseInt(clean.slice(0, 2), 16);
      const g = parseInt(clean.slice(2, 4), 16);
      const b = parseInt(clean.slice(4, 6), 16);
      const newR = r + (target - r) * t;
      const newG = g + (target - g) * t;
      const newB = b + (target - b) * t;
      return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
    }

    function parseOklch(
      color: string,
    ): { l: number; c: number; h: number; percent: boolean } | null {
      const m = color.match(
        /oklch\(\s*([0-9.]+)(%?)\s+([0-9.]+)\s+([0-9.]+)\s*\)/i,
      );
      if (!m) return null;
      const lRaw = parseFloat(m[1]);
      const percent = m[2] === "%";
      const l = percent ? lRaw / 100 : lRaw;
      const c = parseFloat(m[3]);
      const h = parseFloat(m[4]);
      return { l, c, h, percent };
    }

    function formatOklch({
      l,
      c,
      h,
      percent,
    }: {
      l: number;
      c: number;
      h: number;
      percent: boolean;
    }): string {
      const lOut = percent
        ? `${clamp(l * 100, 0, 100).toFixed(1)}%`
        : l.toFixed(3);
      return `oklch(${lOut} ${c} ${h})`;
    }

    function lighten(color: string, t = 0.28): string {
      if (color.startsWith("#")) return adjustHexTowards(color, 255, t);
      const parsed = parseOklch(color);
      if (parsed) {
        return formatOklch({ ...parsed, l: clamp(parsed.l + t, 0, 1) });
      }
      return color;
    }

    function darken(color: string, t = 0.28): string {
      if (color.startsWith("#")) return adjustHexTowards(color, 0, t);
      const parsed = parseOklch(color);
      if (parsed) {
        return formatOklch({ ...parsed, l: clamp(parsed.l - t, 0, 1) });
      }
      return color;
    }

    const withDerived: Record<string, string> = { ...presetVariables };
    const primary = withDerived["--primary"];
    if (primary) {
      if (!withDerived["--primary-light"])
        withDerived["--primary-light"] = lighten(primary);
      if (!withDerived["--primary-dark"])
        withDerived["--primary-dark"] = darken(primary);
    } else {
      // Fallback to defaults if preset does not define primary
      if (!withDerived["--primary-light"])
        withDerived["--primary-light"] = defaultPrimaryLight;
      if (!withDerived["--primary-dark"])
        withDerived["--primary-dark"] = defaultPrimaryDark;
    }

    form.setValue("themeVariables", withDerived, { shouldDirty: true });

    // Apply optimistic updates to CSS variables
    Object.entries(withDerived).forEach(([key, value]) => {
      if (value) {
        document.documentElement.style.setProperty(key, value);
      }
    });

    toast.success(`Applied ${preset.name} preset`);
  }

  function handleReset() {
    const baseline = currentTheme?.variables ?? {};

    // Re-apply CSS variables to match reset state immediately
    THEME_VARIABLES.forEach((key) => {
      const v =
        (baseline as Record<string, string | undefined>)[key] ??
        DEFAULT_THEME.variables?.[key];
      if (v) {
        document.documentElement.style.setProperty(key, v);
      } else {
        document.documentElement.style.removeProperty(key);
      }
    });

    form.reset({
      themeVariables: baseline,
    });
    setSelectedPresetId(undefined);
    toast.success("Changes reset");
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with action buttons */}
      <div className="border-b border-border px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Theme Editor
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Customize your workspace colors and branding
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={isUpdating}
                  className="h-9 px-4 rounded-xl"
                >
                  <Icon name="undo" className="mr-2" size={16} />
                  Reset
                </Button>
                <Button
                  type="button"
                  onClick={() => form.handleSubmit(onSubmit)()}
                  disabled={isUpdating}
                  className="h-9 px-4 rounded-xl"
                >
                  {isUpdating ? (
                    <>
                      <div className="mr-2">
                        <Spinner />
                      </div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Icon name="save" className="mr-2" size={16} />
                      Save
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-5xl mx-auto space-y-6">
          <TooltipProvider>
            <Tabs value="org" className="space-y-4">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="org" className="gap-2">
                  <Icon name="corporate_fare" size={18} />
                  Organization Theme
                </TabsTrigger>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex-1">
                      <TabsTrigger
                        value="project"
                        disabled
                        className="gap-2 w-full cursor-not-allowed opacity-50"
                      >
                        <Icon name="folder" size={18} />
                        Project Theme
                      </TabsTrigger>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Coming soon</p>
                  </TooltipContent>
                </Tooltip>
              </TabsList>

              <TabsContent value="org" className="space-y-4">
                <Card className="border-2">
                  <CardContent className="p-4">
                    <PresetSelector
                      onSelectPreset={handleSelectPreset}
                      selectedPresetId={selectedPresetId}
                    />
                  </CardContent>
                </Card>

                <Card className="border-2 p-4">
                  <CardHeader className="p-0">
                    <CardTitle className="text-base font-semibold">
                      Theme Preview
                    </CardTitle>
                    <CardDescription className="text-xs">
                      See how your theme looks
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 pb-3">
                    <ThemePreview />
                  </CardContent>
                </Card>

                <Card className="border-2">
                  <CardContent className="p-4">
                    <ThemeForm
                      colorGroups={colorGroups}
                      handleVariableChange={handleVariableChange}
                      onSubmit={onSubmit}
                      isUpdating={isUpdating}
                      form={form}
                      saveButtonText="Save Organization Theme"
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
