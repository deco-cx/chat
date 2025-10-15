import { type ReactNode, useEffect, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { useDecopilotOpen } from "../layout/decopilot-layout.tsx";
import { ResourcesV2List } from "../resources-v2/list.tsx";
import { useHideLegacyFeatures } from "../../hooks/use-hide-legacy-features.ts";

/**
 * Documents resource list component that renders the ResourcesV2List
 * with the specific integration ID for documents management
 */
export function DocumentsResourceList({
  headerSlot,
}: {
  headerSlot?: ReactNode;
} = {}) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigateWorkspace = useNavigateWorkspace();
  const { setOpen: setDecopilotOpen } = useDecopilotOpen();
  const { showLegacyFeature } = useHideLegacyFeatures();

  // Automatically open Decopilot if openDecopilot query param is present
  useEffect(() => {
    const openDecopilot = searchParams.get("openDecopilot") === "true";
    if (openDecopilot) {
      setDecopilotOpen(true);
    }
  }, [searchParams, setDecopilotOpen]);

  // Determine active tab based on current route
  const activeTab = useMemo(() => {
    const pathname = location.pathname;
    if (pathname.includes("/documents/prompts")) return "prompts";
    return "all";
  }, [location.pathname]);

  return (
    <ResourcesV2List
      integrationId="i:documents-management"
      resourceName="document"
      headerSlot={headerSlot}
      tabs={[
        {
          id: "all",
          label: "All",
          onClick: () => navigateWorkspace("/documents"),
        },
        ...(showLegacyFeature("hideLegacyPrompts")
          ? [
              {
                id: "prompts",
                label: "Prompts (Legacy)",
                onClick: () => navigateWorkspace("/documents/prompts"),
              },
            ]
          : []),
      ]}
      activeTab={activeTab}
    />
  );
}

export default DocumentsResourceList;
