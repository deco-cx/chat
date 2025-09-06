import { useRegisterActivity } from "../../hooks/use-register-activity.ts";

interface Props {
  orgSlug?: string;
}

export default function RegisterActivity({ orgSlug }: Props) {
  useRegisterActivity(orgSlug);

  return null;
}
