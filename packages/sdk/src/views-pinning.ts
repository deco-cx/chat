import type { View } from "./views.ts";

export interface IntegrationViewSummary {
  name?: string;
  title: string;
  icon: string;
  url?: string;
}

export interface TeamPinnedView {
  id: string;
  title: string;
  icon: string;
  type: "custom";
  integrationId?: string;
  name?: string;
  metadata?: {
    url?: string;
  };
}

export function findPinnedView(
  teamViews: View[] | TeamPinnedView[],
  integrationId: string,
  target: { name?: string; url?: string },
): TeamPinnedView | undefined {
  const views = teamViews as TeamPinnedView[];
  return views.find((v) => {
    const sameIntegration = v?.integrationId === integrationId;
    const sameName = target.name && v?.name === target.name;
    const sameUrl = target.url && v?.metadata?.url === target.url;

    return sameIntegration && (sameName || sameUrl);
  }) as TeamPinnedView | undefined;
}

export function buildAddViewPayload(args: {
  view: IntegrationViewSummary;
  integrationId: string;
}): {
  id: string;
  title: string;
  icon: string;
  type: "custom";
  name: string;
  integration: { id: string };
} {
  const { view, integrationId } = args;
  return {
    id: crypto.randomUUID(),
    title: view.title,
    icon: view.icon,
    type: "custom" as const,
    name: view.name ?? view.title,
    integration: { id: integrationId },
  };
}

export interface IntegrationResourceSummary {
  name: string;
  title: string;
  icon: string;
  resourceType: string;
}

export function buildAddResourcePayload(args: {
  resource: IntegrationResourceSummary;
  integrationId: string;
}): {
  id: string;
  title: string;
  icon: string;
  type: "custom";
  name: string;
  resourceType: string;
  integration: { id: string };
} {
  const { resource, integrationId } = args;
  return {
    id: crypto.randomUUID(),
    title: resource.title,
    icon: resource.icon,
    type: "custom" as const,
    name: resource.name,
    resourceType: resource.resourceType,
    integration: { id: integrationId },
  };
}

export interface BasicViewLike {
  name?: string;
  url?: string;
}

/**
 * Find a view within a list of connection views, supporting the legacy index+viewUrl pattern.
 */
export function findConnectionView<T extends BasicViewLike>(
  views: T[] | undefined,
  opts: { viewName?: string | null; url?: string | null },
): T | undefined {
  const list = views ?? [];
  const { viewName, url } = opts;
  if (viewName === "index" && url) {
    const byUrl = list.find((v) => v?.url === url);
    if (byUrl) return byUrl;
  }
  return list.find((v) => v?.name === viewName);
}
