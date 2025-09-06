import {
  useRegisterActivity as useSDKRegisterActivity,
  useTeam,
} from "@deco/sdk";

export const useRegisterActivity = (org?: string) => {
  const { data: team } = useTeam(org);
  useSDKRegisterActivity(team?.id);
};
