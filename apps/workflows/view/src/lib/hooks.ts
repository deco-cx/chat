import { useSuspenseQuery } from "@tanstack/react-query";
import { client } from "./rpc";
import { FailedToFetchUserError } from "@/components/ui/logged-provider";

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
}

/**
 * This hook will throw an error if the user is not logged in.
 * You can safely use it inside routes that are protected by the `LoggedProvider`.
 */
export const useUser = () => {
  return useSuspenseQuery({
    queryKey: ["user"],
    queryFn: () =>
      client.GET_USER(
        {},
        {
          handleResponse: (res: Response) => {
            if (res.status === 401) {
              throw new FailedToFetchUserError(
                "Failed to fetch user",
                globalThis.location.href,
              );
            }

            return res.json();
          },
        },
      ),
    retry: false,
  });
};
