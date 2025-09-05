import { Navigate } from "react-router";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace";

export function ProjectHome() {
  const workspaceLink = useWorkspaceLink();
  return <Navigate to={workspaceLink("/agents")} />;
}
