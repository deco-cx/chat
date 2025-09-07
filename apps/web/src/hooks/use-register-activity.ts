import {
  useRegisterActivity as useSDKRegisterActivity,
  useTeam,
} from "@deco/sdk";

export const useRegisterActivity = (teamSlug?: string) => {
  const { data: team } = useTeam(teamSlug);
  useSDKRegisterActivity(team?.id);
};
