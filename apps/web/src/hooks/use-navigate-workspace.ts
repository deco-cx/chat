import { useCallback } from "react";
import { useNavigate, useParams } from "react-router";

const joinPaths = (base: string | undefined, path: string) => {
  const withoutStartingSlash = path.startsWith("/") ? path.slice(1) : path;

  return `/${[base, withoutStartingSlash].filter(Boolean).join("/")}`;
};

export const useNavigateWorkspace = () => {
  const navigate = useNavigate();
  const { teamSlug } = useParams();

  const navigateWorkspace = useCallback(
    (path: string) => navigate(joinPaths(teamSlug, path)),
    [navigate, teamSlug],
  );

  return navigateWorkspace;
};

export const useWorkspaceLink = () => {
  const { teamSlug } = useParams();

  const getLinkFor = useCallback(
    (path: string) => joinPaths(teamSlug, path),
    [teamSlug],
  );

  return getLinkFor;
};
