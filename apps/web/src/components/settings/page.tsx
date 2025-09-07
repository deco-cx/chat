import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import { useMemo } from "react";
import { useParams } from "react-router";
import GeneralSettings from "./general.tsx";
import MembersSettings from "./members/index.tsx";
import ModelsSettings from "./models.tsx";

const BASE_TABS: Record<string, Tab> = {
  general: {
    title: "General",
    Component: GeneralSettings,
    initialOpen: true,
    active: false,
  },
  members: {
    title: "Members",
    Component: MembersSettings,
    initialOpen: true,
  },
  models: {
    title: "Models",
    Component: ModelsSettings,
    initialOpen: true,
  },
};

export default function SettingsPage() {
  const { tab } = useParams<{ tab?: string }>();
  // Determine which tab should be active; default to general if not provided or unknown.
  const activeKey = tab && tab in BASE_TABS ? tab : "general";

  const tabs = useMemo(() => {
    return Object.fromEntries(
      Object.entries(BASE_TABS).map(([key, value]) => [
        key,
        {
          ...value,
          active: key === activeKey,
        },
      ]),
    ) as Record<string, Tab>;
  }, [activeKey]);

  return (
    <PageLayout
      tabs={tabs}
      breadcrumb={
        <DefaultBreadcrumb items={[{ label: "Settings", link: "/settings" }]} />
      }
    />
  );
}
