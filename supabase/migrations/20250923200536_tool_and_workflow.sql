-- TOOL AND WORKFLOW policies for tool execution and workflow management
INSERT INTO "public"."policies" ("id", "created_at", "name", "statements", "description", "team_id") VALUES 
('74', '2025-09-23 20:05:36.000000+00', 'execute_tools', ARRAY[
    '{"effect":"allow","resource":"DECO_TOOL_CALL_TOOL"}'::jsonb
], 'Allow users to execute tool calls', null),
('75', '2025-09-23 20:05:36.000000+00', 'manage_workflows', ARRAY[
    '{"effect":"allow","resource":"DECO_WORKFLOW_START"}'::jsonb,
    '{"effect":"allow","resource":"DECO_WORKFLOW_GET_STATUS"}'::jsonb
], 'Allow users to start workflows and check workflow status', null)
ON CONFLICT (id) DO NOTHING;

-- Associate tool execution policy with all roles (1=owner, 3=member, 4=admin)
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('391', '2025-09-23 20:05:36.000000+00', '1', '74'),
('392', '2025-09-23 20:05:36.000000+00', '3', '74'),
('393', '2025-09-23 20:05:36.000000+00', '4', '74')
ON CONFLICT (id) DO NOTHING;

-- Associate workflow management policy with all roles (1=owner, 3=member, 4=admin)
-- Workflow operations are generally safe and should be available to all team members
INSERT INTO "public"."role_policies" ("id", "created_at", "role_id", "policy_id") VALUES 
('394', '2025-09-23 20:05:36.000000+00', '1', '75'),
('395', '2025-09-23 20:05:36.000000+00', '3', '75'),
('396', '2025-09-23 20:05:36.000000+00', '4', '75')
ON CONFLICT (id) DO NOTHING;
