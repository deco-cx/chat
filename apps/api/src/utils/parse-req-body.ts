import { HonoRequest } from "npm:hono@^4.7.9/request";

/**
 * Unescape all escaped dots in a string.
 *
 * Usage: unescapeDots("foo\\.bar\\.baz") -> "foo.bar.baz"
 */
function unescapeDots(key: string): string {
  return key.replaceAll(/\\\./g, ".");
}

/**
 * Convert a FormData instance to a javascript object.
 *
 * Usage:
 * ```ts
 * const formData = new FormData();
 * formData.append("foo", "bar");
 * const props = formDataToProps(formData);
 * console.log(props); // { foo: "bar" }
 * ```
 *
 * @param formData FormData instance to convert.
 * @returns javascript object with the given FormData.
 */
// deno-lint-ignore no-explicit-any
export function formDataToProps(formData: FormData): Record<string, any> {
  // deno-lint-ignore no-explicit-any
  const props: Record<string, any> = {};

  formData.forEach((value, key) => {
    const keys = key.split(/(?<!\\)\./).map(unescapeDots);
    let current = props;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        if (isFinite(Number(keys[i + 1]))) {
          current[keys[i]] = [];
        } else {
          current[keys[i]] = {};
        }
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value instanceof Blob
      ? value
      : String(value);
  });

  return props;
}

/**
 * All props parsing strategies supported by the invoke endpoint.
 * To infer a valid strategy for a request, the `getParsingStrategy` function is used.
 */
export const propsParsers = {
  "json": async (req: HonoRequest) =>
    await req.json() as Record<string, unknown>,
  "try-json": async (req: HonoRequest) => {
    try {
      return await req.json() as Record<string, unknown>;
    } catch (err) {
      console.warn("Error parsing props from request", err);
      return {};
    }
  },
  "form-data": async (req: HonoRequest) => {
    const formData = await req.formData();
    return formDataToProps(formData);
  },
};

/**
 * Gets the `propsParsers` strategy from the given request.
 */
function getParsingStrategy(
  req: HonoRequest,
): keyof typeof propsParsers | null {
  const contentType = req.header("content-type");
  const contentLength = req.header("content-length");

  if (contentLength === "0") {
    return null;
  }

  if (contentType?.startsWith("multipart/form-data")) {
    return "form-data";
  }

  if (!contentLength || !contentType) {
    return "try-json";
  }

  if (contentType.startsWith("application/json")) {
    return "json";
  }

  return null;
}

/**
 * Infers a props parsing strategy from the given request
 * then parses the props from the request.
 * If no strategy is found, an empty object is returned.
 */
export async function parseBodyFromRequestToObject(
  req: HonoRequest,
): Promise<Record<string, unknown>> {
  const strategy = getParsingStrategy(req);

  if (!strategy) {
    return {};
  }

  return await propsParsers[strategy](req);
}
