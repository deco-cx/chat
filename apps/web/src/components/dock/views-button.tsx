import { Icon } from "@deco/ui/components/icon.tsx";
import { openPanel, type Tab, useDock } from "./index.tsx";
import {
  ResponsiveDropdown,
  ResponsiveDropdownContent,
  ResponsiveDropdownItem,
  ResponsiveDropdownTrigger,
} from "@deco/ui/components/responsive-dropdown.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { createPrependPortal } from "../../utils/react-prepend-portal.ts";

// The order of this object's properties matters for sorting
const WELL_KNOWN_VIEW_ICONS = {
  chat: "chat",
  profile: "robot_2",
  prompt: "assignment",
  integrations: "linked_services",
  triggers: "cable",
  general: "settings",
  members: "group",
  models: "batch_prediction",
  usage: "monitoring",
  wallet: "wallet",
  audit: "forum",
  advanced: "settings",
};

function ViewsButtonInner({ tabs }: { tabs: Record<string, Tab> }) {
  const all = Object.entries(tabs);
  const saved = all.filter(([_, tab]) => tab.metadata?.isSavedView);
  const views = all.filter(
    ([_, tab]) => !tab.metadata?.isSavedView && !tab.hideFromViews,
  );

  // Sort views based on WELL_KNOWN_VIEW_ICONS order
  const sortedViews = views.sort(([idA], [idB]) => {
    const indexA = Object.keys(WELL_KNOWN_VIEW_ICONS).indexOf(idA);
    const indexB = Object.keys(WELL_KNOWN_VIEW_ICONS).indexOf(idB);
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return idA.localeCompare(idB);
  });

  return (
    <ResponsiveDropdown>
      <ResponsiveDropdownTrigger>
        <div className="w-8 h-8 hover:bg-background flex items-center justify-center cursor-pointer rounded-xl">
          <Icon name="layers" size={16} />
        </div>
      </ResponsiveDropdownTrigger>
      <ResponsiveDropdownContent align="start" className="p-2 md:min-w-48">
        <span className="p-1 text-xs text-muted-foreground font-medium">
          Views
        </span>
        {sortedViews.map(([id, tab]) => (
          <ResponsiveDropdownItem
            key={id}
            className={cn("text-sm mb-1 rounded-lg hover:bg-muted")}
            onClick={() => {
              openPanel({ id, component: id, title: tab.title });
            }}
          >
            <Icon
              name={
                WELL_KNOWN_VIEW_ICONS[
                  id as keyof typeof WELL_KNOWN_VIEW_ICONS
                ] || "atr"
              }
              className="text-muted-foreground"
              size={16}
            />
            {tab.title}
          </ResponsiveDropdownItem>
        ))}
        {saved.length > 0 && (
          <>
            <span className="p-1 text-xs text-muted-foreground font-medium">
              Saved
            </span>
            {saved.map(([id, tab]) => (
              <ResponsiveDropdownItem
                key={id}
                className={cn("text-xs hover:bg-muted")}
                onClick={() => {
                  openPanel({ id, component: id, title: tab.title });
                }}
              >
                {tab.title}
              </ResponsiveDropdownItem>
            ))}
          </>
        )}
      </ResponsiveDropdownContent>
    </ResponsiveDropdown>
  );
}

export function ViewsButton() {
  const { tabs } = useDock();
  const containers = document.querySelectorAll(".dv-tabs-container");

  if (!containers || containers.length === 0) {
    return null;
  }

  const firstContainer = containers[0];

  return createPrependPortal(
    <div
      key="views-button"
      className="flex items-center text-foreground justify-center w-9 h-8 pr-1"
    >
      <ViewsButtonInner tabs={tabs} />
    </div>,
    firstContainer,
  );
}

ViewsButton.Styles = () => {
  return (
    <style>
      {`
        .dv-tab {
          border-radius: none !important;
          padding: 0 !important;
          height: 2.25rem !important;
        }

        .dv-react-part > div > div[data-active="true"] {
          height: 2.25rem !important;
        }

        .dv-tabs-container {
          height: 2.5rem !important;
          padding-top: 0.25rem;
          padding-left: 0.25rem;
          padding-right: 0.25rem;

      `}
    </style>
  );
};
