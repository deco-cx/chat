export const SETTINGS_ITEMS = [
  {
    url: "/settings",
    title: "General",
    icon: "settings",
  },
  {
    url: "/settings/members",
    title: "Members",
    icon: "group",
  },
  {
    url: "/settings/models",
    title: "Models",
    icon: "model",
  },
  {
    url: "/settings/billing",
    title: "Billing",
    icon: "wallet",
  },
  {
    url: "/settings/usage",
    title: "Usage",
    icon: "monitoring",
  },
  {
    url: "/settings/audit",
    title: "History",
    icon: "quick_reference_all",
  },
] as const;

export type SettingsPage =
  | (typeof SETTINGS_ITEMS)[number]["title"]
  | "general"
  | "members"
  | "billing"
  | "usage"
  | "audit"
  | "models";
