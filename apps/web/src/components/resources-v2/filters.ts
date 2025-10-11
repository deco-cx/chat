import type { z } from "zod";

export type FilterType = "date" | "user" | "select" | "text";

export interface FilterField {
  field: string;
  label: string;
  type: FilterType;
}

/**
 * Detect filterable fields from a Zod schema
 * Returns an array of filter configurations for common fields
 */
export function detectFilterableFields(_schema?: z.ZodSchema): FilterField[] {
  // For now, return common filterable fields
  // This can be extended to introspect the schema in the future
  const commonFilters: FilterField[] = [
    { field: "updated_at", label: "Updated", type: "date" },
    { field: "created_at", label: "Created", type: "date" },
    { field: "updated_by", label: "Updated by", type: "user" },
    { field: "created_by", label: "Created by", type: "user" },
    { field: "status", label: "Status", type: "select" },
  ];

  return commonFilters;
}
