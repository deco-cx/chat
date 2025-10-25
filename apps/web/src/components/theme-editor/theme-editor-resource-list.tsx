import { useMemo } from "react";
import { useParams } from "react-router";
import { useTrackNativeViewVisit, useSDK, type View } from "@deco/sdk";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";
import { ThemeEditorView } from "./theme-editor-view.tsx";

export function ThemeEditorResourceList() {
  const { locator } = useSDK();
  const team = useCurrentTeam();

  // Track visit like Documents so it appears in Recents and can be pinned
  const projectKey = typeof locator === "string" ? locator : undefined;
  const themeViewId = useMemo(() => {
    const views = (team?.views ?? []) as View[];
    const view = views.find((v) => v.title === "Theme");
    return view?.id;
  }, [team?.views]);

  useTrackNativeViewVisit({
    viewId: themeViewId || "theme-editor-fallback",
    viewTitle: "Theme",
    viewIcon: "palette",
    viewPath: `/${projectKey}/theme-editor`,
    projectKey,
  });

  return <ThemeEditorView />;
}
