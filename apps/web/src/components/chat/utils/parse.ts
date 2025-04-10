export const parseHandoffTool = (name: string) => {
  const parsed = name.replace("HANDOFF_", "").replace("_", " ").trim();
  return parsed.charAt(0).toUpperCase() + parsed.slice(1).toLowerCase();
};
