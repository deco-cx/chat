import AuditList from "../audit/list.tsx";
import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import UsageSettings from "../settings/usage.tsx";

const TABS: Record<string, Tab> = {
  usage: {
    title: "Usage",
    Component: UsageSettings,
    initialOpen: true,
    active: true,
  },
  activity: {
    title: "Activity",
    Component: AuditList,
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
