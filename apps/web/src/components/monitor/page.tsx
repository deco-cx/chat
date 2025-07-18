import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import UsageSettings from "../settings/usage.tsx";
import ActivitySettings from "../settings/activity.tsx";
import BillingSettings from "../settings/billing.tsx";

const TABS: Record<string, Tab> = {
  activity: {
    title: "Activity",
    Component: ActivitySettings,
    initialOpen: true,
    active: true,
  },
  usage: {
    title: "Usage",
    Component: UsageSettings,
    initialOpen: true,
  },
  billing: {
    title: "Billing",
    Component: BillingSettings,
    initialOpen: true,
  },
};

export default function MonitorPage() {
  return (
    <PageLayout
      tabs={TABS}
      breadcrumb={
        <DefaultBreadcrumb items={[{ label: "Monitor", link: "/monitor" }]} />
      }
    />
  );
}
