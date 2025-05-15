import { Client } from "@deco/sdk/storage";
import { LRUCache } from "lru-cache";

// Cache duration
const TWO_MIN = 1000 * 60 * 2;

// Base roles
export const BASE_ROLES_ID = {
  OWNER: 1,
  PUBLISHER: 2,
  COLLABORATOR: 3,
  ADMIN: 4,
};

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
  private userPolicyCache: LRUCache<string, Policy[]>;
  private teamRolesCache: LRUCache<number, Role[]>;

  private constructor() {
    // Initialize caches
    this.userPolicyCache = new LRUCache<string, Policy[]>({
      ttl: TWO_MIN,
      max: 1000,
    });
    this.teamRolesCache = new LRUCache<number, Role[]>({
      ttl: TWO_MIN,
      max: 100,
    });
  }

  /**
   * Get singleton instance of PolicyClient
   */
  public static getInstance(): PolicyClient {
    if (!PolicyClient.instance) {
      PolicyClient.instance = new PolicyClient();
    }
    return PolicyClient.instance;
  }

  /**
   * Initialize the policy client with database client
   */
  public init(db: Client): void {
    this.db = db;
  }

  /**
   * Get all policies for a user in a specific team
   */
  public async getUserPolicies(
    userId: string,
    teamIdOrSlug: number | string,
  ): Promise<Policy[]> {
    if (!this.db) {
      throw new Error("PolicyClient not initialized with database client");
    }

    const teamId = typeof teamIdOrSlug === "number"
      ? teamIdOrSlug
      : (await this.db.from("teams").select("id").eq("slug", teamIdOrSlug)
        .single()).data?.id;

    if (teamId === undefined) {
      throw new Error(`Team with slug "${teamIdOrSlug}" not found`);
    }

    const cacheKey = `${userId}:${teamId}`;

    // Try to get from cache first
    const cachedPolicies = this.userPolicyCache.get(cacheKey);
    if (cachedPolicies) {
      return cachedPolicies;
    }

    // Get member ID for the user in this team
    const { data: memberId, error: memberIdError } = await this.db
      .from("members")
      .select("id")
      .eq("user_id", userId)
      .eq("team_id", teamId)
      .is("deleted_at", null)
      .single();

    if (memberIdError || !memberId) {
      return [];
    }

    // Get all roles for this member
    const { data: memberRoles, error: memberRolesError } = await this.db
      .from("member_roles")
      .select("role_id")
      .eq("member_id", memberId.id);

    if (memberRolesError || !memberRoles?.length) {
      return [];
    }

    // Get role details with policies
    const roleIds = memberRoles.map((mr) => mr.role_id);
    const { data: roles, error: rolesError } = await this.db
      .from("roles")
      .select(`
        id,
        name,
        description,
        team_id,
        policies:role_policies(
          policy_id
        )
      `)
      .in("id", roleIds);

    if (rolesError || !roles?.length) {
      return [];
    }

    // Extract all policy IDs from roles
    const policyIds = roles.flatMap((role) =>
      role.policies?.map((rp: { policy_id: number }) => rp.policy_id) || []
    );

    if (!policyIds.length) {
      return [];
    }

    // Get all policy details with statements
    const { data: policies, error: policiesError } = await this.db
      .from("policies")
      .select(`
        id,
        name,
        team_id,
        statements
      `)
      .in("id", policyIds)
      .overrideTypes<Policy[]>();

    if (policiesError || !policies) {
      return [];
    }

    // Cache the result
    this.userPolicyCache.set(cacheKey, policies);

    return policies;
  }

  /**
   * Get all roles for a team
   */
  public async getTeamRoles(teamId: number): Promise<Role[]> {
    if (!this.db) {
      throw new Error("PolicyClient not initialized with database client");
    }

    // Try to get from cache first
    const cachedRoles = this.teamRolesCache.get(teamId);
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
    this.teamRolesCache.set(teamId, roles);

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

    // Get user by email
    const { data: profile } = await this.db
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .single();

    if (!profile) {
      throw new Error("User not found");
    }

    // Get member by user ID and team ID
    const { data: member } = await this.db
      .from("members")
      .select("id")
      .eq("user_id", profile.user_id)
      .eq("team_id", teamId)
      .is("deleted_at", null)
      .single();

    if (!member) {
      throw new Error("Member not found");
    }

    // Get role details
    const { data: role } = await this.db
      .from("roles")
      .select("*")
      .eq("id", params.roleId)
      .single();

    if (!role) {
      throw new Error("Role not found");
    }

    // Special handling for the owner role
    if (params.roleId === BASE_ROLES_ID.OWNER) {
      if (params.action === "revoke") {
        // Check if this would remove the last owner
        const { count } = await this.db
          .from("member_roles")
          .select("role_id", { count: "exact" })
          .eq("role_id", BASE_ROLES_ID.OWNER)
          .eq("member_id", member.id);

        if (count === 1) {
          throw new Error("Cannot remove the last owner of the team");
        }
      }
    }

    // Update the role assignment
    if (params.action === "grant") {
      // Add role to member
      await this.db
        .from("member_roles")
        .upsert({
          member_id: member.id,
          role_id: params.roleId,
        });
    } else {
      // Remove role from member
      await this.db
        .from("member_roles")
        .delete()
        .eq("member_id", member.id)
        .eq("role_id", params.roleId);
    }

    // Invalidate cache for this user
    this.userPolicyCache.delete(`${profile.user_id}:${teamId}`);

    return role;
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
    userId: string,
    teamIdOrSlug: number | string,
    resource: string,
  ): Promise<boolean> {
    const policies = await this.policyClient.getUserPolicies(
      userId,
      teamIdOrSlug,
    );

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
