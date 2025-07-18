/**
 * Convert a string of headers to an object
 * @param headersString - A string of headers separated by commas
 * @returns An object of headers
 */
export const headersStringToObject = (
  headersString: string | undefined | null,
) => {
  if (!headersString) {
    return {};
  }
  const splitByComma = headersString
    .split(",")
    .map((keyVal) => keyVal.split("=") as [string, string]);
  return Object.fromEntries(splitByComma);
};
