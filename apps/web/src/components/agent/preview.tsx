import type { Agent } from "@deco/sdk";
import {
  type DetailedHTMLProps,
  type IframeHTMLAttributes,
  useMemo,
} from "react";
import { ALLOWANCES } from "../../constants.ts";
import { IMAGE_REGEXP } from "../chat/utils/preview.ts";
import type { Tab } from "../dock/index.tsx";

type Props = DetailedHTMLProps<
  IframeHTMLAttributes<HTMLIFrameElement>,
  HTMLIFrameElement
>;

function Preview(props: Props) {
  const isImageLike = props.src && IMAGE_REGEXP.test(props.src);

  if (isImageLike) {
    return (
      <img
        src={props.src}
        alt="Preview"
        className="w-full h-full object-contain"
      />
    );
  }

  return (
    <iframe
      allow={ALLOWANCES}
      allowFullScreen
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      className="w-full h-full"
      {...props}
    />
  );
}

export function useTabsForAgent(
  agent: Agent | undefined,
  baseTabs: Record<string, Tab>,
) {
  // Create dynamic tabs for agent views
  const dynamicViewTabs = useMemo(() => {
    if (!agent?.views?.length) return {};

    const viewTabs: Record<string, Tab> = {};
    agent.views.forEach((view, index) => {
      const tabKey = `view-${index}`;
      viewTabs[tabKey] = {
        Component: () => <Preview src={view.url} title={view.name} />,
        title: view.name,
        initialOpen: index === 0 ? "within" : false, // Open first view by default
        active: index === 0,
        metadata: {
          isSavedView: true,
        },
      };
    });
    return viewTabs;
  }, [agent?.views]);

  // Combine static tabs with dynamic view tabs, placing views after chat
  const allTabs = useMemo(() => {
    const hasViews = Object.keys(dynamicViewTabs).length > 0;

    // If we have views, close all base tabs so only the first view is open
    const tabs = hasViews
      ? Object.fromEntries(
          Object.entries(baseTabs).map(([key, tab]) => [
            key,
            { ...tab, initialOpen: false },
          ]),
        )
      : { ...baseTabs };

    // Insert view tabs after chat tab
    if (hasViews) {
      const tabEntries = Object.entries(tabs);
      const chatIndex = tabEntries.findIndex(([key]) => key === "chat");

      if (chatIndex !== -1) {
        // Split tabs at chat position and insert view tabs after
        const beforeChat = tabEntries.slice(0, chatIndex + 1);
        const afterChat = tabEntries.slice(chatIndex + 1);

        return Object.fromEntries([
          ...beforeChat,
          ...Object.entries(dynamicViewTabs),
          ...afterChat,
        ]);
      }
    }

    return tabs;
  }, [baseTabs, dynamicViewTabs]);

  return allTabs;
}

export default Preview;
