import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import type { TimeRange, UsageType } from "./usage.tsx";

export function UsageFilters({
  usageType,
  setUsageType,
  timeRange,
  setTimeRange,
}: {
  usageType: UsageType;
  setUsageType: (value: UsageType) => void;
  timeRange: TimeRange;
  setTimeRange: (value: TimeRange) => void;
}) {
  return (
    <div className="flex justify-between items-center w-full">
      <Select value={usageType} onValueChange={setUsageType}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Usage by agent" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="agent">Usage by agent</SelectItem>
          <SelectItem value="user">Usage by user</SelectItem>
          <SelectItem value="thread">Usage by thread</SelectItem>
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
    </div>
  );
}
