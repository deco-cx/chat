import { useCallback } from "react";
import { useNavigate, useParams } from "react-router";

const joinPaths = (org: string, project: string, path: string) => {
  const withoutStartingSlash = path.startsWith("/") ? path.slice(1) : path;

  return `/${[org, project, withoutStartingSlash].filter(Boolean).join("/")}`;
};

export const useNavigateWorkspace = () => {
  const navigate = useNavigate();
  const { org, project = "default" } = useParams();

  const navigateWorkspace = useCallback(
    (path: string) => navigate(joinPaths(org!, project, path)),
    [navigate, org, project],
  );

  return navigateWorkspace;
};

export const useWorkspaceLink = () => {
  const { org, project = "default" } = useParams();

  const getLinkFor = useCallback(
    (path: string) => joinPaths(org!, project, path),
    [org, project],
  );

  return getLinkFor;
};
