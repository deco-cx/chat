import { z } from "zod";
import { UserInputError, NotFoundError, InternalServerError } from "../../errors.ts";
import { assertTeamResourceAccess } from "../assertions.ts";
import { createTool } from "./api.ts";

const ToolPermissionSchema = z.object({
    toolName: z.string(),
    effect: z.enum(["allow", "deny"]),
});

const ToolsSchema = z.record(z.string(), z.array(ToolPermissionSchema.extend({ policyId: z.string().optional() })));
const RoleFormDataSchema = z.object({
    name: z.string().min(1, "Role name is required"),
    description: z.string().optional(),
    tools: ToolsSchema,
    agents: z.array(z.string()).optional().default([]),
    members: z.array(z.string()).optional().default([]),
});

export type RoleFormData = z.infer<typeof RoleFormDataSchema>;
export type ToolPermission = z.infer<typeof ToolPermissionSchema>;

const mapToolsToPolicies = (tools: z.infer<typeof ToolsSchema>) => Object.entries(tools || {}).map(([integrationId, toolPermissions]) => {
    if (toolPermissions.length === 0) return null;

    const statements = toolPermissions.map(tool => ({
        effect: tool.effect,
        resource: tool.toolName,
        matchCondition: {
            resource: "is_integration" as const,
            integrationId,
        },
    }));

    const policyName = `policy for i:${integrationId}`;

    const policy = {
        name: policyName,
        statements,
    };

    return policy;
}).filter(p => p !== null)

export const createTeamRole = createTool({
    name: "TEAM_ROLE_CREATE",
    description: "Create a new team role with associated policies and permissions",
    inputSchema: z.object({
        teamId: z.number(),
        roleData: RoleFormDataSchema,
    }),
    handler: async (props, c) => {
        const { teamId, roleData } = props;

        await assertTeamResourceAccess(c.tool.name, teamId, c);

        const { name, description, tools, agents, members } = roleData;

        try {
            const policies = mapToolsToPolicies(tools);

            const newRole = {
                name,
                description: description ?? null,
            }
            const role = await c.policy.createRole(
                teamId,
                newRole,
                policies);

            // TODO: should check the user role to add this?
            if (members && members.length > 0) {
                // Assign role to specified members
                const { data: dbMembers } = await c.db
                    .from("members")
                    .select("profiles(email)")
                    .eq("team_id", teamId)
                    .in("user_id", members);

                const memberRolePromises = dbMembers?.map(async (member) => {
                    if (!member.profiles?.email) return;

                    return await c.policy.updateUserRole(teamId, member.profiles.email, {
                        roleId: role.id,
                        action: "grant",
                    });
                }) ?? [];

                await Promise.all(memberRolePromises);
            }

            // if (agents && agents.length > 0) {
            // Assign role to specified agents
            //     const agentRolePromises = agents.map(async (agentId) => {
            //         return await c.policy.updateUserRole(teamId, agentId, {
            //             roleId: role.id,
            //             action: "grant",
            //         });
            //     });

            //     await Promise.all(agentRolePromises);
            // }

            return {
                id: role.id,
                name: role.name,
                description: role.description,
                team_id: role.team_id,
                tools: tools || {},
                agents: agents || [],
                members: members || [],
            };
        } catch (error) {
            console.error("Error creating team role:", error);
            throw new InternalServerError("Failed to create team role");
        }
    },
});

export const deleteTeamRole = createTool({
    name: "TEAM_ROLE_DELETE",
    description: "Delete a team role and its associated policies (only team-specific roles)",
    inputSchema: z.object({
        teamId: z.number(),
        roleId: z.number(),
    }),
    handler: async (props, c) => {
        const { teamId, roleId } = props;

        await assertTeamResourceAccess(c.tool.name, teamId, c);

        try {
            await c.policy.deleteRole(teamId, roleId);

            return { success: true, deletedRoleId: roleId };
        } catch (error) {
            if (error instanceof Error && error.message.includes("Cannot delete system roles")) {
                throw new UserInputError("Cannot delete system roles. Only team-specific roles can be deleted.");
            }
            console.error("Error deleting team role:", error);
            throw new InternalServerError("Failed to delete team role");
        }
    },
});

export const updateTeamRole = createTool({
    name: "TEAM_ROLE_UPDATE",
    description: "Update a team role and its associated policies",
    inputSchema: z.object({
        teamId: z.number(),
        roleId: z.number(),
        roleData: RoleFormDataSchema,
    }),
    handler: async (props, c) => {
        const { teamId, roleId, roleData } = props;

        await assertTeamResourceAccess(c.tool.name, teamId, c);

        const { name, description, tools, agents, members } = roleData;

        try {
            const policies = mapToolsToPolicies(tools);

            // Update the role using PolicyClient
            const updatedRole = await c.policy.updateRole(teamId, {
                id: roleId,
                name,
                description: description || null,
            }, policies);

            if (!updatedRole) {
                throw new InternalServerError("Failed to update role");
            }

            // TODO: should check the user role to add this?
            if (members && members.length > 0) {
                // Assign role to specified members
                const { data: dbMembers } = await c.db
                    .from("members")
                    .select("profiles(email)")
                    .eq("team_id", teamId)
                    .in("user_id", members);

                const memberRolePromises = dbMembers?.map(async (member) => {
                    if (!member.profiles?.email) return;

                    return await c.policy.updateUserRole(teamId, member.profiles.email, {
                        roleId: updatedRole.id,
                        action: "grant",
                    });
                }) ?? [];

                await Promise.all(memberRolePromises);
            }

            // TODO: update agents roles

            return {
                id: updatedRole.id,
                name: updatedRole.name,
                description: updatedRole.description,
                team_id: updatedRole.team_id,
                tools: tools || {},
                agents: agents || [],
                members: members || [],
            };
        } catch (error) {
            console.error("Error updating team role:", error);
            throw new InternalServerError("Failed to update team role");
        }
    },
});

export const getTeamRole = createTool({
    name: "TEAM_ROLE_GET",
    description: "Get detailed information about a specific team role",
    inputSchema: z.object({
        teamId: z.number(),
        roleId: z.number(),
    }),
    handler: async (props, c) => {
        const { teamId, roleId } = props;

        await assertTeamResourceAccess(c.tool.name, teamId, c);

        try {
            // Get role with policies using PolicyClient
            const roleWithPolicies = await c.policy.getRoleWithPolicies(teamId, roleId);

            if (!roleWithPolicies) {
                throw new NotFoundError("Role not found or doesn't belong to this team");
            }

            // Get assigned members
            const { data: memberRoles } = await c.db
                .from("member_roles")
                .select("members(user_id)")
                .eq("role_id", roleId);

            // Parse tools from policies
            const tools: Record<string, ToolPermission[]> = {};
            if (roleWithPolicies.policies) {
                roleWithPolicies.policies.forEach(policy => {
                    if (policy.statements) {
                        policy.statements.forEach(statement => {
                            if (statement.matchCondition?.resource === "is_integration") {
                                const integrationId = statement.matchCondition.integrationId;
                                if (!tools[integrationId]) {
                                    tools[integrationId] = [];
                                }
                                tools[integrationId].push({
                                    toolName: statement.resource,
                                    effect: statement.effect as "allow" | "deny",
                                });
                            }
                        });
                    }
                });
            }

            // Extract member user IDs
            const members = memberRoles?.map(mr => (mr.members as { user_id: string }).user_id) || [];

            return {
                id: roleWithPolicies.id,
                name: roleWithPolicies.name,
                description: roleWithPolicies.description,
                team_id: roleWithPolicies.team_id,
                tools,
                agents: [], // TODO: Implement agent associations
                members,
            };
        } catch (error) {
            console.error("Error getting team role:", error);
            if (error instanceof NotFoundError) {
                throw error;
            }
            throw new InternalServerError("Failed to get team role");
        }
    },
}); 