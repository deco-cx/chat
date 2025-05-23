import { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import BillingSettings from "./billing.tsx";
import GeneralSettings from "./general.tsx";
import MembersSettings from "./members.tsx";
import UsageSettings from "./usage.tsx";

const TABS: Record<string, Tab> = {
  members: {
    title: "Members",
    Component: MembersSettings,
    initialOpen: true,
  },
  general: {
    title: "General",
    Component: GeneralSettings,
    initialOpen: true,
  },
  billing: {
    title: "Billing",
    Component: BillingSettings,
    initialOpen: true,
  },
  usage: {
    title: "Usage",
    Component: UsageSettings,
  },
};

export default function SettingsPage() {
  return (
    <PageLayout
      tabs={TABS}
      breadcrumb={
        <DefaultBreadcrumb items={[{ label: "Settings", link: "/settings" }]} />
      }
    />
  );
}
