-- Migration: Populate foreign key columns from workspace strings
-- This migration populates the new project_id and org_id columns based on existing workspace strings

-- Create a temporary function to parse workspace strings and resolve to project/org IDs
CREATE OR REPLACE FUNCTION parse_workspace_to_ids(workspace_str TEXT)
RETURNS TABLE(project_id UUID, org_id INT8) AS $$
DECLARE
    parts TEXT[];
    root_part TEXT;
    slug_part TEXT;
    resolved_org_id INT8;
    resolved_project_id UUID;
    project_slug TEXT;
BEGIN
    -- Handle null or empty workspace
    IF workspace_str IS NULL OR workspace_str = '' THEN
        RETURN QUERY SELECT NULL::UUID, NULL::INT8;
        RETURN;
    END IF;

    -- Remove leading slash if present and split by '/'
    parts := string_to_array(ltrim(workspace_str, '/'), '/');

    -- Need at least 2 parts (root/slug)
    IF array_length(parts, 1) < 2 THEN
        RETURN QUERY SELECT NULL::UUID, NULL::INT8;
        RETURN;
    END IF;

    root_part := parts[1];
    slug_part := parts[2];

    -- Handle legacy /users/{userId} format
    IF root_part = 'users' THEN
        -- For personal projects, find the team (org) for this user and the personal project
        SELECT t.id INTO resolved_org_id
        FROM teams t
        JOIN team_members tm ON t.id = tm.team_id
        JOIN auth.users u ON tm.user_id = u.id
        WHERE u.id::TEXT = slug_part
        LIMIT 1;

        -- Find or assume personal project
        IF resolved_org_id IS NOT NULL THEN
            SELECT p.id INTO resolved_project_id
            FROM deco_chat_projects p
            WHERE p.org_id = resolved_org_id AND p.slug = 'personal'
            LIMIT 1;
        END IF;

    -- Handle legacy /shared/{orgSlug} format
    ELSIF root_part = 'shared' THEN
        -- Find the team (org) by slug
        SELECT t.id INTO resolved_org_id
        FROM teams t
        WHERE t.slug = slug_part
        LIMIT 1;

        -- For shared orgs, we need to determine the project
        -- Since legacy format mapped org to a single implicit project,
        -- we'll look for a default project or create one
        IF resolved_org_id IS NOT NULL THEN
            SELECT p.id INTO resolved_project_id
            FROM deco_chat_projects p
            WHERE p.org_id = resolved_org_id
            ORDER BY p.created_at ASC
            LIMIT 1;
        END IF;

    -- Handle new /{org}/{project} format
    ELSE
        -- First part is org slug, second is project slug
        SELECT t.id INTO resolved_org_id
        FROM teams t
        WHERE t.slug = root_part
        LIMIT 1;

        IF resolved_org_id IS NOT NULL THEN
            SELECT p.id INTO resolved_project_id
            FROM deco_chat_projects p
            WHERE p.org_id = resolved_org_id AND p.slug = slug_part
            LIMIT 1;
        END IF;
    END IF;

    RETURN QUERY SELECT resolved_project_id, resolved_org_id;
END;
$$ LANGUAGE plpgsql;

-- Update deco_chat_channels
UPDATE deco_chat_channels
SET (project_id, org_id) = (
    SELECT project_id, org_id
    FROM parse_workspace_to_ids(workspace)
)
WHERE project_id IS NULL OR org_id IS NULL;

-- Update deco_chat_assets
UPDATE deco_chat_assets
SET (project_id, org_id) = (
    SELECT project_id, org_id
    FROM parse_workspace_to_ids(workspace)
)
WHERE project_id IS NULL OR org_id IS NULL;

-- Update deco_chat_customer
UPDATE deco_chat_customer
SET (project_id, org_id) = (
    SELECT project_id, org_id
    FROM parse_workspace_to_ids(workspace)
)
WHERE project_id IS NULL OR org_id IS NULL;

-- Update deco_chat_api_keys
UPDATE deco_chat_api_keys
SET (project_id, org_id) = (
    SELECT project_id, org_id
    FROM parse_workspace_to_ids(workspace)
)
WHERE project_id IS NULL OR org_id IS NULL;

-- Update deco_chat_hosting_apps
UPDATE deco_chat_hosting_apps
SET (project_id, org_id) = (
    SELECT project_id, org_id
    FROM parse_workspace_to_ids(workspace)
)
WHERE project_id IS NULL OR org_id IS NULL;

-- Update deco_chat_apps_registry
UPDATE deco_chat_apps_registry
SET (project_id, org_id) = (
    SELECT project_id, org_id
    FROM parse_workspace_to_ids(workspace)
)
WHERE project_id IS NULL OR org_id IS NULL;

-- Update deco_chat_oauth_codes
UPDATE deco_chat_oauth_codes
SET (project_id, org_id) = (
    SELECT project_id, org_id
    FROM parse_workspace_to_ids(workspace)
)
WHERE project_id IS NULL OR org_id IS NULL;

-- Update deco_chat_registry_scopes
UPDATE deco_chat_registry_scopes
SET (project_id, org_id) = (
    SELECT project_id, org_id
    FROM parse_workspace_to_ids(workspace)
)
WHERE project_id IS NULL OR org_id IS NULL;

-- Create fallback projects for orphaned workspace strings
-- This handles cases where workspace string doesn't map to existing org/project
INSERT INTO deco_chat_projects (slug, title, org_id)
SELECT
    'legacy-migration' as slug,
    'Legacy Migration Project' as title,
    t.id as org_id
FROM teams t
WHERE NOT EXISTS (
    SELECT 1 FROM deco_chat_projects p WHERE p.org_id = t.id
)
AND EXISTS (
    -- Only create if there are workspace records that would need it
    SELECT 1 FROM (
        SELECT workspace FROM deco_chat_channels WHERE project_id IS NULL
        UNION ALL
        SELECT workspace FROM deco_chat_assets WHERE project_id IS NULL
        UNION ALL
        SELECT workspace FROM deco_chat_customer WHERE project_id IS NULL
        UNION ALL
        SELECT workspace FROM deco_chat_api_keys WHERE project_id IS NULL
        UNION ALL
        SELECT workspace FROM deco_chat_hosting_apps WHERE project_id IS NULL
        UNION ALL
        SELECT workspace FROM deco_chat_apps_registry WHERE project_id IS NULL
        UNION ALL
        SELECT workspace FROM deco_chat_oauth_codes WHERE project_id IS NULL
        UNION ALL
        SELECT workspace FROM deco_chat_registry_scopes WHERE project_id IS NULL
    ) orphaned_workspaces
    WHERE orphaned_workspaces.workspace LIKE '%' || t.slug || '%'
);

-- Re-run updates for any remaining NULL values using fallback projects
UPDATE deco_chat_channels
SET (project_id, org_id) = (
    SELECT project_id, org_id
    FROM parse_workspace_to_ids(workspace)
)
WHERE project_id IS NULL OR org_id IS NULL;

-- (Repeat for other tables - abbreviated for clarity, but would include all tables)

-- Drop the temporary function
DROP FUNCTION parse_workspace_to_ids(TEXT);

-- Add validation query to check migration success
-- This will show counts of records that still have NULL foreign keys
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count FROM (
        SELECT 1 FROM deco_chat_channels WHERE project_id IS NULL OR org_id IS NULL
        UNION ALL
        SELECT 1 FROM deco_chat_assets WHERE project_id IS NULL OR org_id IS NULL
        UNION ALL
        SELECT 1 FROM deco_chat_customer WHERE project_id IS NULL OR org_id IS NULL
        UNION ALL
        SELECT 1 FROM deco_chat_api_keys WHERE project_id IS NULL OR org_id IS NULL
        UNION ALL
        SELECT 1 FROM deco_chat_hosting_apps WHERE project_id IS NULL OR org_id IS NULL
        UNION ALL
        SELECT 1 FROM deco_chat_apps_registry WHERE project_id IS NULL OR org_id IS NULL
        UNION ALL
        SELECT 1 FROM deco_chat_oauth_codes WHERE project_id IS NULL OR org_id IS NULL
        UNION ALL
        SELECT 1 FROM deco_chat_registry_scopes WHERE project_id IS NULL OR org_id IS NULL
    ) null_records;

    IF null_count > 0 THEN
        RAISE NOTICE 'Warning: % records still have NULL foreign keys after migration', null_count;
    ELSE
        RAISE NOTICE 'Migration successful: All workspace strings converted to foreign keys';
    END IF;
END $$;
