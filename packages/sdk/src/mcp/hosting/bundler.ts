/**
 * Bundles the given files into a single string.
 *
 * @param files - A record of file paths to their content.
 * @param entrypoint - The entrypoint file path.
 * @returns The bundled code as a string.
 */
export const bundler = async (
  files: Record<string, string>,
  entrypoint: string = "index.ts",
): Promise<string> => {
  const response = await fetch("https://bundler.deco.site", {
    method: "POST",
    body: JSON.stringify({ files, entrypoint }),
    headers: {
      "content-type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to bundle ${await response.text()}`);
  }

  const responseJson: { base64: string } = await response.json();
  return decodeURIComponent(escape(atob(responseJson.base64)));
};
