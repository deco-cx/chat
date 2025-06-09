import { z } from "zod";
import { InternalServerError } from "../index.ts";
import { assertPrincipalIsUser } from "./assertions.ts";
import type { AppContext } from "./context.ts";

export const AccessSchema = z.object({
  id: z.string(),
  visibility: z.enum(["public", "private", "role_based"]),
  allowed_roles: z.array(z.string()).nullable(),
  owner_id: z.string(),
});

export const AccessArraySchema = z.array(z.string())
  .default(["private"])
  .optional()
  .describe(
    "Add 'public' to allow anyone with the link to view and use the agent, 'private' allow only the owner to view and use the agent, 'role-based' allow only the users with the specified roles to view and use the agent",
  );

export const withAccessSchema = <T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
) => z.object({ ...schema.shape, access: AccessArraySchema });

export type WithAccess<T> = T & { access: AccessInput };

export type Access = z.infer<typeof AccessSchema>;
export type AccessInput = z.infer<typeof AccessArraySchema>;

export const restoreAccessTypes = (
  access: Pick<Access, "visibility" | "allowed_roles"> | null,
) => {
  if (!access) return null;

  if (access.visibility === "public") {
    return ["public"];
  }
  if (access.visibility === "private") {
    return ["private"];
  }
  // For role_based, return the allowed_roles array
  return access.allowed_roles;
};

const getAccessType = (
  visibilityMixins: string[] | undefined,
) => {
  if (!visibilityMixins) return "role_based";

  if (visibilityMixins.includes("public")) {
    return "public";
  }
  if (visibilityMixins.includes("private")) {
    return "private";
  }
  return "role_based";
};

export const createAccess = async (c: AppContext, access: AccessInput) => {
  assertPrincipalIsUser(c);

  const visibilityType = getAccessType(access);

  const { data, error } = await c.db
    .from("deco_chat_access")
    .insert({
      owner_id: c.user.id,
      visibility: visibilityType,
      allowed_roles: visibilityType === "role_based" ? access : null,
    })
    .select()
    .single();

  if (error) {
    throw new InternalServerError(error.message);
  }

  return AccessSchema.parse(data);
};

export const updateAccess = async (
  c: AppContext,
  id: string,
  access: AccessInput,
) => {
  const visibilityType = getAccessType(access);

  const { data, error: mixinError } = await c.db
    .from("deco_chat_access")
    .update({
      visibility: visibilityType,
      allowed_roles: visibilityType === "role_based" ? access : null,
    })
    .eq("id", id)
    .select()
    .single();

  if (mixinError) {
    throw new InternalServerError(mixinError.message);
  }

  return AccessSchema.parse(data);
};
