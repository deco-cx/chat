import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout/project.tsx";
import { Usage } from "../settings/usage/usage.tsx";
import ActivitySettings from "../settings/activity.tsx";
import BillingSettings from "../settings/billing.tsx";
import { useMemo } from "react";
import { useParams } from "react-router";
import { DecopilotProvider } from "../decopilot/context.tsx";

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

  // Prepare decopilot context value for monitor
  const decopilotContextValue = useMemo(() => {
    const rules: string[] = [
      `You are helping with workspace monitoring and analytics. Focus on operations related to activity tracking, usage monitoring, and billing management.`,
      `When working with monitoring, prioritize operations that help users understand their workspace activity, track usage patterns, and manage billing. Consider the current active tab (${activeKey}) when providing assistance.`,
    ];
    
    return {
      rules,
    };
  }, [activeKey]);

  return (
    <DecopilotProvider value={decopilotContextValue}>
      <PageLayout
        tabs={tabs}
        breadcrumb={
          <DefaultBreadcrumb items={[{ label: "Monitor", link: "/monitor" }]} />
        }
      />
    </DecopilotProvider>
  );
}
