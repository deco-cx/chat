/**
 * TODO: remove this code once this is accepted:
 * https://github.com/modelcontextprotocol/typescript-sdk/pull/528
 */

import {
  AudioContentSchema,
  EmbeddedResourceSchema,
  ImageContentSchema,
  ResultSchema,
  TextContentSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod/v3";

export const CallToolResultSchema = ResultSchema.extend({
  /**
   * A list of content objects that represent the result of the tool call.
   *
   * If the Tool does not define an outputSchema, this field MUST be present in the result.
   * For backwards compatibility, this field is always present, but it may be empty.
   */
  content: z
    .array(
      z.union([
        TextContentSchema,
        ImageContentSchema,
        AudioContentSchema,
        EmbeddedResourceSchema,
      ]),
    )
    .default([]),

  /**
   * An object containing structured tool output.
   *
   * If the Tool defines an outputSchema, this field MUST be present in the result, and contain a JSON object that matches the schema.
   */
  structuredContent: z.any().optional(),

  /**
   * Whether the tool call ended in an error.
   *
   * If not set, this is assumed to be false (the call was successful).
   *
   * Any errors that originate from the tool SHOULD be reported inside the result
   * object, with `isError` set to true, _not_ as an MCP protocol-level error
   * response. Otherwise, the LLM would not be able to see that an error occurred
   * and self-correct.
   *
   * However, any errors in _finding_ the tool, an error indicating that the
   * server does not support tool calls, or any other exceptional conditions,
   * should be reported as an MCP error response.
   */
  isError: z.optional(z.boolean()),
});
