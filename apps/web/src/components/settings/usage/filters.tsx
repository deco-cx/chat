import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import type { TimeRange, UsageType } from "./usage.tsx";
import { useIntegrations } from "@deco/sdk";

export function UsageFilters({
  usageType,
  setUsageType,
  timeRange,
  setTimeRange,
  contractId,
  setContractId,
  availableContracts = [],
  clauseId,
  setClauseId,
  availableClauses = [],
}: {
  usageType: UsageType;
  setUsageType: (value: UsageType) => void;
  timeRange: TimeRange;
  setTimeRange: (value: TimeRange) => void;
  contractId?: string | null;
  setContractId?: (value: string | null) => void;
  availableContracts?: string[];
  clauseId?: string | null;
  setClauseId?: (value: string | null) => void;
  availableClauses?: string[];
}) {
  const { data: integrations } = useIntegrations();
  return (
    <div className="flex justify-between items-center w-full gap-4">
      <Select value={usageType} onValueChange={setUsageType}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Usage by agent" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="agent">Usage by agent</SelectItem>
          <SelectItem value="user">Usage by user</SelectItem>
          <SelectItem value="thread">Usage by thread</SelectItem>
          <SelectItem value="contract">Usage by contract</SelectItem>
        </SelectContent>
      </Select>

      <Select value={timeRange} onValueChange={setTimeRange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Last 7 days" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="day">Last 24 hours</SelectItem>
          <SelectItem value="week">Last 7 days</SelectItem>
          <SelectItem value="month">This month</SelectItem>
        </SelectContent>
      </Select>

      {usageType === "contract" && setContractId && (
        <Select
          value={contractId ?? "__all__"}
          onValueChange={(val) => setContractId(val === "__all__" ? null : val)}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All contracts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All contracts</SelectItem>
            {availableContracts.map((id, i) => (
              <SelectItem key={i} value={id}>
                {integrations?.find((integration) => integration.id === id)
                  ?.name || id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {usageType === "contract" && setClauseId && (
        <Select
          value={clauseId ?? "__all__"}
          onValueChange={(val) => setClauseId(val === "__all__" ? null : val)}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All clauses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All clauses</SelectItem>
            {availableClauses.map((id, i) => (
              <SelectItem key={i} value={id}>
                {id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
