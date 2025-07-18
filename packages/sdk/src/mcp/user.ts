import type { User as SupaUser } from "@supabase/supabase-js";
import type { User } from "../index.ts";

export const userFromDatabase = (user: SupaUser): User => {
  const metadata = getUserMetadata(user);

  return { ...user, metadata } as unknown as User;
};

const getUserMetadata = (user: SupaUser): User["metadata"] => {
  // @ts-expect-error - Supabase user metadata is not typed
  const metadata = user?.metadata?.raw_user_meta_data;

  const full_name = metadata?.full_name;
  const avatar_url = metadata?.avatar_url;
  const username = full_name
    ? generateUsername(full_name)
    : (user?.email ?? "");
  const email = user?.email ?? "";

  return { full_name, avatar_url, username, email };
};

const generateUsername = (fullName: string) => {
  const username = `${fullName
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "")}${Date.now().toString(36)}`;

  return username;
};
