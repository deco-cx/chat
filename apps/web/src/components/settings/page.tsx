import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import GeneralSettings from "./general.tsx";
import MembersSettings from "./members.tsx";
import WalletSettings from "./wallet.tsx";
import UsageSettings from "./usage.tsx";
import ModelsSettings from "./models.tsx";

const TABS: Record<string, Tab> = {
  general: {
    title: "General",
    Component: GeneralSettings,
    initialOpen: true,
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
  usage: {
    title: "Usage",
    Component: UsageSettings,
    initialOpen: "left",
    active: true,
  },
  wallet: {
    title: "Wallet",
    Component: WalletSettings,
    initialOpen: "right",
    active: true,
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
