import type { Integration } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { IntegrationIcon } from "./icon.tsx";
export function IntegrationHeader({
  integration,
  enabledTools,
}: {
  integration: Integration;
  tools: string[];
  enabledTools: string[];
}) {
  const numberOfEnabledTools = enabledTools.length;

  return (
    <div className="w-full px-4 py-[10px]">
      <div className="flex w-full items-center gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <IntegrationIcon
            icon={integration.icon}
            name={integration.name}
            className="h-4 w-4 rounded border-none"
          />
          <div className="font-medium text-sm text-slate-700 truncate">
            {integration?.name}
          </div>
          <span className="text-xs text-slate-400">
            {numberOfEnabledTools} tools
          </span>
        </div>
      </div>
    </div>
  );
}

IntegrationHeader.Skeleton = () => (
  <div className="w-full p-4">
    <div className="flex w-full items-center justify-between gap-2">
      <div className="flex items-center gap-2 flex-grow">
        <Skeleton className="h-6 w-6 rounded-md" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  </div>
);

IntegrationHeader.Error = ({
  integration,
}: {
  integration: Integration;
}) => (
  <div className="w-full p-4">
    <div className="flex w-full items-center justify-between gap-2">
      <div className="flex items-center gap-2 flex-grow">
        <IntegrationIcon icon={integration.icon} name={integration.name} />
        <h3 className="font-medium text-base">{integration.name}</h3>
      </div>

      <div className="flex items-center gap-2">
        <Icon name="cancel" className="text-xs text-red-500" size={16} />
        <span className="text-sm text-red-500">Error</span>
      </div>
    </div>
  </div>
);
