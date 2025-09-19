# Workspace Migration Guide

## Overview

This migration transitions the system from using workspace strings (`/{org}/{project}` format) to strong foreign key references to projects and organizations. This change enables multiple projects per organization and improves data integrity and performance.

## Migration Timeline

### ✅ Phase 1: Database Schema Updates (Backward Compatible)
- **Status**: COMPLETED
- **Files**:
  - `supabase/migrations/20250918000000_add_workspace_foreign_keys.sql`
  - `supabase/migrations/20250918000001_populate_workspace_foreign_keys.sql`

**Changes Made:**
- Added `project_id UUID` and `org_id INT8` columns to all workspace tables
- Added foreign key constraints to `deco_chat_projects.id` and `teams.id`
- Created indexes on new columns
- Kept existing `workspace TEXT` columns for backward compatibility
- Created migration script to populate foreign keys from workspace strings

**Tables Updated:**
- `deco_chat_channels`
- `deco_chat_assets`
- `deco_chat_customer`
- `deco_chat_api_keys`
- `deco_chat_hosting_apps`
- `deco_chat_apps_registry`
- `deco_chat_oauth_codes`
- `deco_chat_registry_scopes`

### ✅ Phase 2: TypeScript Schema Updates
- **Status**: COMPLETED
- **Files**: `packages/sdk/src/storage/supabase/schema.ts`

**Changes Made:**
- Added `org_id: number | null` and `project_id: string | null` to Row types
- Added optional foreign key fields to Insert and Update types
- Maintained backward compatibility with existing workspace fields

### ✅ Phase 3: Application Code Migration
- **Status**: COMPLETED
- **Files**:
  - `packages/sdk/src/mcp/workspace-helpers.ts` (new)
  - `packages/sdk/src/mcp/channels/api.ts`
  - `packages/sdk/src/mcp/api-keys/api.ts`
  - `packages/sdk/src/mcp/registry/api.ts`
  - `packages/sdk/src/mcp/hosting/api.ts`

**Changes Made:**
- Created helper functions for workspace to foreign key resolution
- Updated all database queries to use transition pattern
- Maintained backward compatibility during migration period
- Added foreign key population to INSERT operations

## Migration Architecture

### Helper Functions

**`smartResolveProjectOrgIds(db, context)`**
- Resolves project and org IDs from locator (preferred) or workspace string (fallback)
- Returns `{ projectId: string, orgId: number }`

**`createTransitionQuery(query, ids, workspaceValue?)`**
- Creates backward-compatible queries using OR logic
- Matches either new foreign keys OR old workspace strings
- Ensures data access during migration period

### Query Migration Pattern

```typescript
// OLD PATTERN:
const workspace = c.workspace.value;
const query = db
  .from("deco_chat_channels")
  .select("*")
  .eq("workspace", workspace);

// NEW PATTERN:
const ids = await smartResolveProjectOrgIds(db, c);
const baseQuery = db
  .from("deco_chat_channels")
  .select("*");
const query = createTransitionQuery(baseQuery, ids, c.workspace?.value);
```

### Context Resolution Priority

1. **Primary**: Use `c.locator` with org/project structure
2. **Fallback**: Parse `c.workspace.value` string
3. **Legacy handling**: Support `/users/{userId}` and `/shared/{org}` formats

## Benefits Achieved

### Performance Improvements
- Direct foreign key joins vs string parsing/conversion
- Better query optimization with proper indexes
- Reduced computational overhead in workspace resolution

### Data Integrity
- Referential integrity constraints prevent orphaned records
- Strong typing with UUID/INT foreign keys vs string manipulation
- Cascade delete options for cleanup

### Scalability Enhancements
- Support for multiple projects per organization
- Cleaner data model for future feature development
- Better separation of org vs project-level resources

### Maintainability
- Centralized workspace resolution logic
- Consistent query patterns across API files
- Single source of truth for project/org relationships

## Testing Strategy

### Database Migration Testing
```sql
-- Verify foreign key population
SELECT COUNT(*) as total_records,
       COUNT(project_id) as populated_project_ids,
       COUNT(org_id) as populated_org_ids
FROM deco_chat_channels;

-- Check referential integrity
SELECT c.id, c.workspace, c.project_id, c.org_id
FROM deco_chat_channels c
LEFT JOIN deco_chat_projects p ON c.project_id = p.id
LEFT JOIN teams t ON c.org_id = t.id
WHERE (c.project_id IS NOT NULL AND p.id IS NULL)
   OR (c.org_id IS NOT NULL AND t.id IS NULL);
```

### Application Testing
1. **Backward Compatibility**: Ensure existing workspace-based requests work
2. **New Locator Support**: Test org/project-based API requests
3. **Data Consistency**: Verify queries return same results with both approaches
4. **Performance**: Benchmark query performance improvements

## Rollout Plan

### Phase A: Database Migration (Low Risk)
1. Apply schema migrations during maintenance window
2. Run data population scripts
3. Verify foreign key population completed successfully
4. Monitor for migration errors or orphaned data

### Phase B: Application Deployment (Medium Risk)
1. Deploy application code with transition queries
2. Monitor API response times and error rates
3. Verify backward compatibility with existing clients
4. Test new locator-based functionality

### Phase C: Legacy Cleanup (Breaking Change)
**⚠️ FUTURE PHASE - NOT YET IMPLEMENTED**
1. Remove workspace string columns from database
2. Remove workspace conversion logic from application code
3. Update API responses to exclude workspace strings
4. Clean up deprecated helper functions

## Monitoring & Rollback

### Key Metrics to Monitor
- Database query performance (especially on workspace tables)
- API response times for workspace-related endpoints
- Error rates during workspace resolution
- Foreign key constraint violations

### Rollback Strategy
- Phase 1-2: Safe to rollback via database migration rollback
- Phase 3: Can rollback application code while keeping schema changes
- Database retains both workspace strings and foreign keys during transition

## Files Changed

### Database
- `supabase/migrations/20250918000000_add_workspace_foreign_keys.sql`
- `supabase/migrations/20250918000001_populate_workspace_foreign_keys.sql`

### Schema
- `packages/sdk/src/storage/supabase/schema.ts`

### Application Code
- `packages/sdk/src/mcp/workspace-helpers.ts` (new)
- `packages/sdk/src/mcp/channels/api.ts`
- `packages/sdk/src/mcp/api-keys/api.ts`
- `packages/sdk/src/mcp/registry/api.ts`
- `packages/sdk/src/mcp/hosting/api.ts`

### Documentation
- `WORKSPACE_MIGRATION.md` (this file)

## Next Steps

1. **Testing**: Run comprehensive tests on the migration
2. **Review**: Code review for the migration changes
3. **Staging Deploy**: Test on staging environment with production-like data
4. **Production Deploy**: Gradual rollout with monitoring
5. **Future Cleanup**: Plan Phase C (workspace string removal) for future release
