export const formatFilename = (filename: string) => {
  return (
    filename
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-") // spaces and underscores to hyphens
      .replace(/[^a-z0-9.-]/g, "") // remove non-alphanumeric except dots and hyphens
      .replace(/-+/g, "-") // multiple hyphens to single
      .replace(/^-+|-+$/g, "") || // trim hyphens
    "untitled"
  );
};
