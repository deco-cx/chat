UPDATE "public"."policies" SET "statements" = ARRAY[
    '{"effect":"allow","resource":"deco-sites/admin/actions/teams/inviteMembers.ts"}'::jsonb,
    '{"effect":"allow","resource":"deco-sites/admin/actions/invites/resendInviteEmail.ts"}'::jsonb,
    '{"effect":"allow","resource":"deco-sites/admin/actions/invites/delete.ts"}'::jsonb,
    '{"effect":"allow","resource":"deco-sites/admin/actions/roles/updateUserRole.ts"}'::jsonb,
    '{"effect":"allow","resource":"deco-sites/admin/actions/teams/removeMember.ts"}'::jsonb,
    '{"effect":"allow","resource":"TEAM_MEMBERS_UPDATE"}'::jsonb,
    '{"effect":"allow","resource":"TEAM_MEMBERS_REMOVE"}'::jsonb,
    '{"effect":"allow","resource":"TEAM_MEMBERS_INVITE"}'::jsonb,
    '{"effect":"allow","resource":"TEAM_MEMBERS_UPDATE_ROLE"}'::jsonb,
] WHERE "id" = 2;
