/**
 * TODO(camudo): Handle custom fonts
 */

export const THEME_VARIABLES = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--destructive-foreground",
  "--success",
  "--success-foreground",
  "--warning",
  "--warning-foreground",
  "--border",
  "--input",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
  "--primary-light",
  "--primary-dark",
  "--splash",
] as const;
export type ThemeVariable = (typeof THEME_VARIABLES)[number];
export interface GoogleFontsThemeFont {
  type: "Google Fonts";
  name: string;
}

export interface CustomUploadedThemeFont {
  type: "Custom";
  name: string;
  url: string;
}

export interface Theme {
  variables?: Partial<Record<ThemeVariable, string>>;
  picture?: string;
  font?: GoogleFontsThemeFont | CustomUploadedThemeFont;
}

export const DEFAULT_THEME: Theme = {
  variables: {
    "--background": "oklch(0.9938 0.0013 106.42)",
    "--foreground": "oklch(26.8% 0.007 34.298)",
    "--primary-light": "#d0ec1a",
    "--primary-dark": "#07401a",
    "--card": "oklch(97.8% 0.001 106.423)",
    "--card-foreground": "oklch(26.8% 0.007 34.298)",
    "--popover": "oklch(1 0 0)",
    "--popover-foreground": "oklch(26.8% 0.007 34.298)",
    "--primary": "oklch(26.8% 0.007 34.298)",
    "--primary-foreground": "oklch(98.5% 0.001 106.423)",
    "--secondary": "oklch(97% 0.001 106.424)",
    "--secondary-foreground": "oklch(26.8% 0.007 34.298)",
    "--muted": "oklch(97% 0.001 106.424)",
    "--muted-foreground": "oklch(55.3% 0.013 58.071)",
    "--accent": "oklch(0.9466 0.0017 67.8)",
    "--accent-foreground": "oklch(26.8% 0.007 34.298)",
    "--destructive": "oklch(0.577 0.245 27.325)",
    "--destructive-foreground": "oklch(1 0 0)",
    "--success": "oklch(0.654 0.184 142.0)",
    "--success-foreground": "oklch(0.963 0.025 137.0)",
    "--warning": "oklch(0.877 0.184 99.0)",
    "--warning-foreground": "oklch(0.293 0.071 70.0)",
    "--border": "oklch(92.3% 0.003 48.717)",
    "--input": "oklch(92.3% 0.003 48.717)",
    "--sidebar": "oklch(98.5% 0.001 106.423)",
    "--sidebar-foreground": "oklch(26.8% 0.007 34.298)",
    "--sidebar-accent": "oklch(95.8% 0.003 48.717)",
    "--sidebar-accent-foreground": "oklch(26.8% 0.007 34.298)",
    "--sidebar-border": "oklch(92.3% 0.003 48.717)",
    "--sidebar-ring": "oklch(92.3% 0.003 48.717)",
  },

  font: {
    type: "Google Fonts",
    name: "Inter",
  },
};
