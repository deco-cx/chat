import { useQuery } from "@tanstack/react-query";

const GITHUB_REPO = "deco-cx/chat";

async function fetchGitHubStars() {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`);
  if (!response.ok) {
    throw new Error("Failed to fetch GitHub stars");
  }
  const data = (await response.json()) as { stargazers_count: number };
  return data.stargazers_count;
}

export function useGitHubStars() {
  return useQuery({
    queryKey: ["github-stars"],
    queryFn: fetchGitHubStars,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
