const WORKSPACE_ACTIVITY_KEY = "workspaceActivity";

export function getWorkspaceActivity(): string[] {
  try {
    const item = globalThis.localStorage.getItem(WORKSPACE_ACTIVITY_KEY);
    return item ? JSON.parse(item) : [];
  } catch (error) {
    console.error("Failed to read workspace activity from localStorage", error);
    return [];
  }
}

export function addWorkspaceToActivity(slug: string) {
  if (!slug) {
    return;
  }
  try {
    let activity = getWorkspaceActivity();
    activity = activity.filter((item) => item !== slug);
    activity.unshift(slug);
    globalThis.localStorage.setItem(
      WORKSPACE_ACTIVITY_KEY,
      JSON.stringify(activity),
    );
  } catch (error) {
    console.error("Failed to save workspace activity to localStorage", error);
  }
}
