import { useRegisterActivity } from "../../hooks/use-register-activity.ts";

interface Props {
  teamSlug?: string;
}

export default function RegisterActivity({ teamSlug }: Props) {
  useRegisterActivity(teamSlug);

  return null;
}
