import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import { Usage } from "../settings/usage/usage.tsx";
import ActivitySettings from "../settings/activity.tsx";
import BillingSettings from "../settings/billing.tsx";
import { useMemo } from "react";
import { useParams } from "react-router";

const BASE_TABS: Record<string, Tab> = {
  activity: {
    title: "Activity",
    Component: ActivitySettings,
    initialOpen: true,
    active: false,
  },
  usage: {
    title: "Usage",
    Component: Usage,
    initialOpen: true,
  },
  billing: {
    title: "Billing",
    Component: BillingSettings,
    initialOpen: true,
  },
};

export default function MonitorPage() {
  const { tab } = useParams<{ tab?: string }>();
  const activeKey = tab && tab in BASE_TABS ? tab : "activity";

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
        <DefaultBreadcrumb items={[{ label: "Monitor", link: "/monitor" }]} />
      }
    />
  );
}
