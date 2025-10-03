import { z } from "zod/v3";
import { InternalServerError, NotFoundError } from "../../errors.ts";
import { assertHasUser, assertPrincipalIsUser } from "../assertions.ts";
import { UnauthorizedError } from "../index.ts";
import { createTool } from "../members/api.ts";
import { userFromDatabase } from "../user.ts";

export const getProfile = createTool({
  name: "PROFILES_GET",
  description: "Get the current user's profile",
  inputSchema: z.lazy(() => z.object({})),
  handler: async (_, c) => {
    assertHasUser(c);
    assertPrincipalIsUser(c);

    c.resourceAccess.grant(); // Using bypass equivalent

    const user = c.user;

    if (user.is_anonymous) {
      throw new UnauthorizedError();
    }

    // TODO: change profile data to have necessary info
    const { data, error } = await c.db
      .from("profiles")
      .select(`
        id:user_id,
        name,
        email,
        phone,
        metadata:users_meta_data_view(id, raw_user_meta_data)
      `)
      .eq("user_id", user.id)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    // @ts-expect-error - Supabase user metadata is not typed
    return userFromDatabase(data);
  },
});

export const updateProfile = createTool({
  name: "PROFILES_UPDATE",
  description: "Update the current user's profile",
  inputSchema: z.lazy(() =>
    z.object({
      name: z.string().nullable().optional(),
      email: z.string().optional(),
      deco_user_id: z.number().nullable().optional(),
      is_new_user: z.boolean().nullable().optional(),
      phone: z.string().nullable().optional(),
    }),
  ),
  handler: async ({ name, email, deco_user_id, is_new_user, phone }, c) => {
    assertPrincipalIsUser(c);
    assertHasUser(c);

    c.resourceAccess.grant(); // Using bypass equivalent

    const user = c.user;

    const { data, error } = await c.db
      .from("profiles")
      .update({
        name,
        email,
        deco_user_id,
        is_new_user,
        phone,
      })
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    if (!data) {
      throw new NotFoundError("Profile not found");
    }

    return data;
  },
});
