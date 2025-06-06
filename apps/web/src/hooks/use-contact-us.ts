/**
 * @camudo: Changing this for a self-service flow soon
 */
import { useSDK } from "@deco/sdk";

const getContactUsUrl = (workspace: string) => {
  const url = new URL("mailto:sales@deco.chat");
  url.searchParams.set(
    "subject",
    encodeURIComponent(`Workspace ${workspace} Plan Upgrade`),
  );
  url.searchParams.set(
    "body",
    encodeURIComponent(
      `Hi, I'm a member of workspace ${workspace} on deco chat and I'd like to upgrade my plan so I can invite other member to join my workspace`,
    ),
  );
  return url.toString();
};

export const useContactUsUrl = () => {
  const { workspace } = useSDK();

  return getContactUsUrl(workspace);
};
