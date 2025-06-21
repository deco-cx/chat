import { type Agent, type Space } from "@deco/sdk";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import type { Tab } from "../../dock/index.tsx";

// Default Edit space configuration
const DEFAULT_EDIT_SPACE: Space = {
  title: "Edit",
  viewSetup: {
    // This will be populated with the actual dock configuration
    layout: "default",
    openPanels: ["chat", "prompt", "integrations", "setup"],
    initialLayout: {
      chat: { position: "left", initialOpen: true },
      prompt: { position: "within", initialOpen: true },
      integrations: { position: "within", initialOpen: true },
      setup: { position: "right", initialOpen: true },
    },
  },
  theme: {
    // Default theme variables - could be overridden for dark mode
    "--background": "oklch(1 0 0)",
    "--foreground": "oklch(26.8% 0.007 34.298)",
  },
};

interface UseSpacesOptions {
  agent: Agent;
  baseTabs: Record<string, Tab>;
  onSpaceChange?: (spaceId: string) => void;
}

export function useSpaces({ agent, baseTabs, onSpaceChange }: UseSpacesOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get current space from URL or default to 'edit'
  const currentSpaceId = searchParams.get("space") || "edit";
  
  // Initialize spaces with default Edit space and any saved spaces
  const spaces = useMemo(() => {
    const savedSpaces = agent.spaces || {};
    return {
      edit: DEFAULT_EDIT_SPACE,
      ...savedSpaces,
    };
  }, [agent.spaces]);

  const currentSpace = spaces[currentSpaceId] || DEFAULT_EDIT_SPACE;

  // Create tabs based on current space configuration
  const tabsForSpace = useMemo(() => {
    const spaceConfig = currentSpace.viewSetup;
    const configuredTabs: Record<string, Tab> = {};

    // Apply space configuration to tabs
    Object.entries(baseTabs).forEach(([tabId, tab]) => {
      const tabConfig = spaceConfig?.initialLayout?.[tabId];
      configuredTabs[tabId] = {
        ...tab,
        initialOpen: tabConfig?.initialOpen || tab.initialOpen,
        // Apply any other space-specific tab configurations
      };
    });

    return configuredTabs;
  }, [baseTabs, currentSpace]);

  const changeSpace = (spaceId: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (spaceId === "edit") {
      newParams.delete("space");
    } else {
      newParams.set("space", spaceId);
    }
    setSearchParams(newParams);
    onSpaceChange?.(spaceId);
  };

  const saveSpace = (spaceId: string, spaceName: string) => {
    // This would typically call an API to save the space
    // For now, we'll just update the local state
    console.log("Saving space:", { spaceId, spaceName });
    
    // In a real implementation, this would:
    // 1. Capture current dock layout
    // 2. Save to agent.spaces
    // 3. Update the agent via API
    
    const newSpace: Space = {
      title: spaceName,
      viewSetup: {
        // Capture current dock state here
        layout: "custom",
        openPanels: Object.keys(tabsForSpace),
      },
      theme: currentSpace.theme,
    };

    // This would trigger an agent update
    console.log("Would save space:", newSpace);
  };

  const deleteSpace = (spaceId: string) => {
    if (spaceId === "edit") return; // Can't delete the default space
    
    // This would typically call an API to delete the space
    console.log("Deleting space:", spaceId);
    
    // If deleting current space, switch to edit
    if (spaceId === currentSpaceId) {
      changeSpace("edit");
    }
  };

  return {
    spaces,
    currentSpace: currentSpaceId,
    currentSpaceData: currentSpace,
    tabsForSpace,
    changeSpace,
    saveSpace,
    deleteSpace,
  };
}