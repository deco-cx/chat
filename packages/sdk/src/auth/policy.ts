import type { Client } from "@deco/sdk/storage";
import { WebCache } from "../cache/index.ts";

// Cache duration in seconds (WebCache expects seconds)
const TWO_MIN_TTL = 60 * 2;

// Base roles
export const BASE_ROLES_ID = {
  OWNER: 1,
  PUBLISHER: 2,
  COLLABORATOR: 3,
  ADMIN: 4,
};

const BLOCKED_ROLES = new Set([BASE_ROLES_ID.PUBLISHER]);

// Typed interfaces
export interface Statement {
  effect: "allow" | "deny";
  resource: string;
}

export interface Policy {
  id: number;
  name: string;
  team_id: number | null;
  statements: Statement[];
}

export interface Role {
  id: number;
  name: string;
  description?: string | null;
  team_id: number | null;
}

export interface RoleWithPolicies extends Role {
  policies: Policy[];
}

export interface MemberRole {
  member_id: number;
  role_id: number;
  name: string;
  role?: Role;
}

export interface RoleUpdateParams {
  roleId: number;
  action: "grant" | "revoke";
}

/**
 * PolicyClient - Singleton class for managing policy access
 */
export class PolicyClient {
  private static instance: PolicyClient | null = null;
  private db: Client | null = null;
  private userPolicyCache: WebCache<Pick<Policy, "statements">[]>;
  private userRolesCache: WebCache<MemberRole[]>;
  private teamRolesCache: WebCache<Role[]>;
  private teamSlugCache: WebCache<number>;

  private constructor() {
    // Initialize caches
    this.userPolicyCache = new WebCache<Pick<Policy, "statements">[]>(
      "user-policies",
      TWO_MIN_TTL,
    );
    this.userRolesCache = new WebCache<MemberRole[]>("user-roles", TWO_MIN_TTL);
    this.teamRolesCache = new WebCache<Role[]>("team-role", TWO_MIN_TTL);
    this.teamSlugCache = new WebCache<number>("team-slug", TWO_MIN_TTL);
  }

  /**
   * Get singleton instance of PolicyClient
   */
  public static getInstance(db: Client): PolicyClient {
    if (!PolicyClient.instance) {
      PolicyClient.instance = new PolicyClient();
    }
    PolicyClient.instance.db = db;
    return PolicyClient.instance;
  }

  public async getUserRoles(
    userId: string,
    teamIdOrSlug: number | string,
  ): Promise<MemberRole[]> {
    if (!this.db) {
      throw new Error("PolicyClient not initialized with database client");
    }

    const teamId =
      typeof teamIdOrSlug === "number"
        ? teamIdOrSlug
        : await this.getTeamIdBySlug(teamIdOrSlug);

    const cacheKey = this.getUserRolesCacheKey(userId, teamId);

    const cachedRoles = await this.userRolesCache.get(cacheKey);
    if (cachedRoles) {
      return cachedRoles;
    }

    const { data } = await this.db
      .from("members")
      .select(`
        id,
        member_roles(
          role_id,
          roles(
            id,
            name
          )
        )
      `)
      .eq("user_id", userId)
      .eq("team_id", teamId)
      .single();

    if (!data?.member_roles) {
      return [];
    }

    const roles: MemberRole[] = data.member_roles.map(
      (mr: { role_id: number; roles: { id: number; name: string } }) => ({
        member_id: data.id,
        role_id: mr.role_id,
        name: mr.roles.name,
        role: {
          ...mr.roles,
          team_id: teamId,
        },
      }),
    );

    // Cache the result
    await this.userRolesCache.set(cacheKey, roles);

    return roles;
  }

  /**
   * Get all policies for a user in a specific team
   */
  public async getUserPolicies(
    userId: string,
    teamIdOrSlug: number | string,
  ): Promise<Pick<Policy, "statements">[]> {
    if (!this.db) {
      throw new Error("PolicyClient not initialized with database client");
    }

    const teamId =
      typeof teamIdOrSlug === "number"
        ? teamIdOrSlug
        : await this.getTeamIdBySlug(teamIdOrSlug);

    if (teamId === undefined) {
      throw new Error(`Team with slug "${teamIdOrSlug}" not found`);
    }

    const cacheKey = this.getUserPoliceCacheKey(userId, teamId);

    // Try to get from cache first
    const cachedPolicies = await this.userPolicyCache.get(cacheKey);
    if (cachedPolicies) {
      return cachedPolicies;
    }

    const { data, error: policiesError } = await this.db
      .from("member_roles")
      .select(`
            members!inner(team_id, user_id),
            roles (
              role_policies (
                policies (
                  statements
                )
              )
            )
          `)
      .eq("members.team_id", teamId)
      .eq("members.user_id", userId);

    const policies = data?.map((memberRole) => ({
      statements: memberRole.roles.role_policies
        .map(
          (rolePolicies) =>
            (rolePolicies.policies.statements as unknown as Statement[]) ?? [],
        )
        .flat(),
    }));

    if (policiesError || !policies) {
      return [];
    }

    // Cache the result
    await this.userPolicyCache.set(
      cacheKey,
      this.filterValidPolicies(policies),
    );

    return policies;
  }

  public async removeAllMemberPoliciesAtTeam({
    teamId,
    memberId,
  }: {
    teamId: number;
    memberId: number;
  }) {
    if (!this.db) {
      throw new Error("PolicyClient not initialized with database client");
    }

    // Get member's user_id for cache invalidation
    const { data: member } = await this.db
      .from("members")
      .select("user_id")
      .eq("id", memberId)
      .single();

    // Invalidate caches if we have the user_id
    if (member?.user_id) {
      await Promise.all([
        this.userPolicyCache.delete(
          this.getUserPoliceCacheKey(member.user_id, teamId),
        ),
        this.userRolesCache.delete(
          this.getUserRolesCacheKey(member.user_id, teamId),
        ),
      ]);
    }

    const { error } = await this.db
      .from("member_roles")
      .delete()
      .eq("member_id", memberId);

    if (error) throw error;

    return true;
  }

  /**
   * Get all roles for a team
   */
  public async getTeamRoles(teamId: number): Promise<Role[]> {
    if (!this.db) {
      throw new Error("PolicyClient not initialized with database client");
    }

    // Try to get from cache first
    const cachedRoles = await this.teamRolesCache.get(
      this.getTeamRolesCacheKey(teamId),
    );
    if (cachedRoles) {
      return cachedRoles;
    }

    const { data: roles, error } = await this.db
      .from("roles")
      .select(`
        id,
        name,
        description,
        team_id
      `)
      .or(`team_id.eq.${teamId},team_id.is.null`);

    if (error || !roles) {
      return [];
    }

    // Cache the result
    await this.teamRolesCache.set(
      this.getTeamRolesCacheKey(teamId),
      this.filterTeamRoles(roles),
    );

    return roles;
  }

  /**
   * Update a user's role in a team
   */
  public async updateUserRole(
    teamId: number,
    email: string,
    params: RoleUpdateParams,
  ): Promise<Role | null> {
    if (!this.db) {
      throw new Error("PolicyClient not initialized with database client");
    }

    const [{ data: memberWithProfile }, roles] = await Promise.all([
      this.db
        .from("members")
        .select("id, profiles!inner(email, user_id)")
        .eq("team_id", teamId)
        .eq("profiles.email", email)
        .single(),
      this.getTeamRoles(teamId),
    ]);

    const profile = memberWithProfile?.profiles;
    const role = roles.find((r) => r.id === params.roleId);

    if (!profile) {
      throw new Error("User not found");
    }

    if (!memberWithProfile) {
      throw new Error("Member not found");
    }

    if (!role) {
      throw new Error("Role not found");
    }

    // Special handling for the owner role
    if (params.roleId === BASE_ROLES_ID.OWNER) {
      if (params.action === "revoke") {
        // Check if this would remove the last owner
        const { count } = await await this.db
          .from("members")
          .select(
            `
          id,
          team_id,
          member_roles!inner(
            role_id
          )
        `,
            { count: "exact" },
          )
          .eq("team_id", teamId)
          .eq("member_roles.role_id", BASE_ROLES_ID.OWNER);

        if (count === 1) {
          throw new Error("Cannot remove the last owner of the team");
        }
      }
    }

    // Invalidate all caches for this user
    await Promise.all([
      this.userPolicyCache.delete(
        this.getUserPoliceCacheKey(profile.user_id, teamId),
      ),
      this.userRolesCache.delete(
        this.getUserRolesCacheKey(profile.user_id, teamId),
      ),
    ]);

    // Update the role assignment
    if (params.action === "grant") {
      // Add role to member
      await this.db.from("member_roles").upsert({
        member_id: memberWithProfile.id,
        role_id: params.roleId,
      });
    } else {
      // Remove role from member
      await this.db
        .from("member_roles")
        .delete()
        .eq("member_id", memberWithProfile.id)
        .eq("role_id", params.roleId);
    }

    return role;
  }

  private async getTeamIdBySlug(teamSlug: string): Promise<number> {
    const cachedTeamId = await this.teamSlugCache.get(teamSlug);
    if (cachedTeamId) return cachedTeamId;

    const teamId = (
      await this.db?.from("teams").select("id").eq("slug", teamSlug).single()
    )?.data?.id;

    if (!teamId) throw new Error(`Not found team id with slug: ${teamSlug}`);

    await this.teamSlugCache.set(teamSlug, teamId);
    return teamId;
  }

  private filterValidPolicies<T extends Pick<Policy, "statements">>(
    policies: T[],
  ): T[] {
    return policies.map((policy) => ({
      ...policy,
      // filter admin policies
      statements: policy.statements.filter((r) => !r.resource.endsWith(".ts")),
    }));
  }

  public filterTeamRoles<R extends Pick<Role, "id">>(roles: R[]): R[] {
    return roles.filter((r) => !BLOCKED_ROLES.has(r.id));
  }

  private getUserPoliceCacheKey(userId: string, teamId: number) {
    return `${userId}:${teamId}`;
  }

  private getUserRolesCacheKey(userId: string, teamId: number) {
    return `${userId}:${teamId}`;
  }

  private getTeamRolesCacheKey(teamId: number) {
    return teamId.toString();
  }
}

/**
 * Authorization service for evaluating access permissions
 */
export class AuthorizationClient {
  private policyClient: PolicyClient;

  constructor(policyClient: PolicyClient) {
    this.policyClient = policyClient;
  }

  /**
   * Check if a user has access to a specific resource
   */
  public async canAccess(
    userOrPolicies: string | Pick<Policy, "statements">[],
    teamIdOrSlug: number | string,
    resource: string,
  ): Promise<boolean> {
    const policies =
      typeof userOrPolicies === "string"
        ? await this.policyClient.getUserPolicies(userOrPolicies, teamIdOrSlug)
        : userOrPolicies;

    if (!policies.length) {
      return false;
    }

    let hasAllowMatch = false;

    // Evaluation algorithm: deny overrides allow
    for (const policy of policies) {
      for (const statement of policy.statements) {
        // Check if statement applies to this resource
        const resourceMatch = this.matchResource(statement.resource, resource);

        if (resourceMatch) {
          // Explicit deny always overrides any allows
          if (statement.effect === "deny") {
            return false;
          }

          if (statement.effect === "allow") {
            hasAllowMatch = true;
          }
        }
      }
    }

    return hasAllowMatch;
  }

  /**
   * Check if a resource pattern matches the requested resource
   */
  private matchResource(pattern: string, resource: string): boolean {
    return pattern === resource;
  }
}
