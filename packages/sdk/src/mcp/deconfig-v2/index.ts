import { z } from "zod";
import { NotFoundError, UserInputError } from "../../index.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { impl } from "../bindings/binder.ts";
import { AppContext } from "../context.ts";
import { createMCPToolsStub, DeconfigClient, MCPClientStub } from "../index.ts";
import {
  BaseResourceDataSchema,
  createResourceV2Bindings,
} from "../resources-v2/bindings.ts";
import { ResourceUriSchema } from "../resources-v2/schemas.ts";

/**
 * DeconfigResources 2.0
 *
 * This module provides file-based resource management using the Resources 2.0 system
 * with standardized `rsc://` URI format and consistent CRUD operations.
 *
 * Key Features:
 * - File-based resource storage in DECONFIG directories
 * - Resources 2.0 standardized schemas and URI format
 * - Type-safe resource definitions with Zod validation
 * - Full CRUD operations with proper error handling
 * - Integration with existing deconfig file system
 * - Support for custom resource schemas and enhancements
 */

export type ResourcesV2Binding<TDataSchema extends BaseResourceDataSchema> =
  ReturnType<typeof createResourceV2Bindings<TDataSchema>>;
export type ResourcesV2Tools<TDataSchema extends BaseResourceDataSchema> =
  ResourcesV2Binding<TDataSchema>[number]["name"];

export type EnhancedResourcesV2Tools<
  TDataSchema extends BaseResourceDataSchema,
> = Partial<
  Record<
    ResourcesV2Tools<TDataSchema>,
    {
      description: string;
    }
  >
>;

export interface DeconfigResourceV2Options<
  TDataSchema extends BaseResourceDataSchema,
> {
  deconfig: DeconfigClient;
  directory: string;
  resourceName: string;
  dataSchema: TDataSchema;
  group?: string;
  integrationId?: string;
  enhancements?: EnhancedResourcesV2Tools<TDataSchema>;
  validate?: (
    data: z.infer<TDataSchema>,
    context: AppContext,
    deconfig: DeconfigClient,
  ) => Promise<void>;
}

const normalizeDirectory = (dir: string) => {
  // Ensure directory starts with / and doesn't end with /
  const normalized = dir.startsWith("/") ? dir : `/${dir}`;
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
};

const buildFilePath = (directory: string, resourceId: string) => {
  const normalizedDir = normalizeDirectory(directory);
  return `${normalizedDir}/${resourceId}.json`;
};

const extractResourceId = (uri: string) => {
  // Extract ID from Resources 2.0 URI format: rsc://integrationId/resourceName/resource-id
  const match = uri.match(/^rsc:\/\/[^\/]+\/[^\/]+\/(.+)$/);
  if (!match) {
    throw new UserInputError("Invalid Resources 2.0 URI format");
  }
  return match[1];
};

const constructResourceUri = (
  integrationId: string,
  resourceName: string,
  resourceId: string,
) => {
  return `rsc://${integrationId}/${resourceName}/${resourceId}`;
};

function getMetadataValue(metadata: unknown, key: string): unknown {
  if (!metadata || typeof metadata !== "object") return undefined;
  const metaObj = metadata as Record<string, unknown>;
  if (key in metaObj) return metaObj[key];
  const nested = metaObj.metadata;
  if (nested && typeof nested === "object" && key in nested) {
    return (nested as Record<string, unknown>)[key];
  }
  return undefined;
}

function getMetadataString(metadata: unknown, key: string): string | undefined {
  const value = getMetadataValue(metadata, key);
  return typeof value === "string" ? value : undefined;
}

export const DeconfigResourceV2 = {
  define: <TDataSchema extends BaseResourceDataSchema>(
    options: Omit<
      DeconfigResourceV2Options<TDataSchema>,
      "deconfig" | "integrationId"
    >,
  ) => {
    return {
      client: (
        deconfig: DeconfigClient,
        integrationId: string,
      ): MCPClientStub<ResourcesV2Binding<TDataSchema>> => {
        const tools = deconfigResourceV2({
          deconfig,
          ...options,
          integrationId,
        });
        return createMCPToolsStub({
          tools,
        }) as MCPClientStub<ResourcesV2Binding<TDataSchema>>;
      },
      create: (deconfig: DeconfigClient, integrationId: string) => {
        return deconfigResourceV2({
          deconfig,
          ...options,
          integrationId,
        });
      },
    };
  },
};

export const deconfigResourceV2 = <TDataSchema extends BaseResourceDataSchema>(
  options: DeconfigResourceV2Options<TDataSchema>,
) => {
  const {
    deconfig,
    directory,
    resourceName,
    dataSchema,
    integrationId,
    enhancements,
    group,
    validate: semanticValidate,
  } = options;

  if (!integrationId) {
    throw new Error("integrationId is required for DeconfigResourceV2");
  }

  // Create resource-specific bindings using the provided data schema
  const resourceBindings = createResourceV2Bindings(resourceName, dataSchema);

  const tools = impl(resourceBindings, [
    // deco_resource_search
    {
      description:
        enhancements?.[
          `DECO_RESOURCE_${resourceName.toUpperCase()}_SEARCH` as keyof typeof enhancements
        ]?.description ||
        `Search ${resourceName} resources in the DECONFIG directory ${directory}`,
      handler: async (
        { term, page = 1, pageSize = 10, filters, sortBy, sortOrder },
        c,
      ) => {
        assertHasWorkspace(c);
        await assertWorkspaceResourceAccess(c, "LIST_FILES");

        const normalizedDir = normalizeDirectory(directory);
        const offset = pageSize !== Infinity ? (page - 1) * pageSize : 0;

        // List all files in the directory
        const filesList = await deconfig.LIST_FILES({
          prefix: normalizedDir,
        });

        // Filter files that end with .json
        const allFiles = Object.entries(filesList.files)
          .filter(([path]) => path.endsWith(".json"))
          .map(([path, metadata]) => ({
            path,
            resourceId: path
              .replace(`${normalizedDir}/`, "")
              .replace(".json", ""),
            metadata,
          }));

        // Simple search - filter by resource ID, path, title, description, created_by, or updated_by
        let filteredFiles = allFiles;
        if (term) {
          filteredFiles = allFiles.filter(({ resourceId, path, metadata }) => {
            const searchTerm = term.toLowerCase();
            return (
              resourceId.toLowerCase().includes(searchTerm) ||
              path.toLowerCase().includes(searchTerm) ||
              (
                getMetadataString(metadata, "name")?.toLowerCase() ?? ""
              ).includes(searchTerm) ||
              (
                getMetadataString(metadata, "description")?.toLowerCase() ?? ""
              ).includes(searchTerm) ||
              (
                getMetadataString(metadata, "createdBy")?.toLowerCase() ?? ""
              ).includes(searchTerm) ||
              (
                getMetadataString(metadata, "updatedBy")?.toLowerCase() ?? ""
              ).includes(searchTerm)
            );
          });
        }

        // Apply additional filters if provided
        if (filters) {
          const createdByFilter = filters.created_by as
            | string
            | string[]
            | undefined;
          const updatedByFilter = filters.updated_by as
            | string
            | string[]
            | undefined;

          if (createdByFilter) {
            const createdBySet = new Set(
              Array.isArray(createdByFilter)
                ? createdByFilter.map((v) => String(v))
                : [String(createdByFilter)],
            );
            filteredFiles = filteredFiles.filter(({ metadata }) => {
              const value = getMetadataString(metadata, "createdBy");
              return value ? createdBySet.has(value) : false;
            });
          }

          if (updatedByFilter) {
            const updatedBySet = new Set(
              Array.isArray(updatedByFilter)
                ? updatedByFilter.map((v) => String(v))
                : [String(updatedByFilter)],
            );
            filteredFiles = filteredFiles.filter(({ metadata }) => {
              const value = getMetadataString(metadata, "updatedBy");
              return value ? updatedBySet.has(value) : false;
            });
          }
        }

        // Sort if specified
        if (sortBy) {
          filteredFiles.sort((a, b) => {
            let aValue: string | number;
            let bValue: string | number;

            if (sortBy === "resourceId") {
              aValue = a.resourceId;
              bValue = b.resourceId;
            } else if (sortBy === "name") {
              aValue = getMetadataString(a.metadata, "name") || a.resourceId;
              bValue = getMetadataString(b.metadata, "name") || b.resourceId;
            } else if (sortBy === "description") {
              aValue = getMetadataString(a.metadata, "description") || "";
              bValue = getMetadataString(b.metadata, "description") || "";
            } else {
              aValue = a.metadata.mtime;
              bValue = b.metadata.mtime;
            }

            if (sortOrder === "desc") {
              return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
            } else {
              return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
            }
          });
        }

        // Apply pagination
        const totalCount = filteredFiles.length;
        const totalPages = Math.ceil(totalCount / pageSize);
        const hasNextPage = offset + pageSize < totalCount;
        const hasPreviousPage = page > 1;
        const items = filteredFiles.slice(offset, offset + pageSize);

        return {
          items: items.map(({ resourceId, metadata }) => {
            // Construct Resources 2.0 URI
            const uri = constructResourceUri(
              options.integrationId!, // integrationId
              options.resourceName, // resourceName
              resourceId,
            );

            // Extract title and description from metadata, with fallbacks
            const name = getMetadataString(metadata, "name") || resourceId; // Fallback to resourceId (basename)
            const description =
              getMetadataString(metadata, "description") || ""; // Fallback to empty string

            // For search operations, we only return title and description
            // The full data structure is available through the read operation

            return {
              uri,
              data: { name, description },
              created_at:
                "ctime" in metadata && typeof metadata.ctime === "number"
                  ? new Date(metadata.ctime).toISOString()
                  : undefined,
              updated_at:
                "mtime" in metadata && typeof metadata.mtime === "number"
                  ? new Date(metadata.mtime).toISOString()
                  : undefined,
              created_by: getMetadataString(metadata, "createdBy"),
              updated_by:
                getMetadataString(metadata, "updatedBy") ||
                getMetadataString(metadata, "createdBy"),
            };
          }),
          totalCount,
          page,
          pageSize,
          totalPages,
          hasNextPage,
          hasPreviousPage,
        };
      },
    },

    // deco_resource_read
    {
      description:
        enhancements?.[
          `DECO_RESOURCE_${resourceName.toUpperCase()}_READ` as keyof typeof enhancements
        ]?.description ||
        `Read a ${resourceName} resource from the DECONFIG directory ${directory}`,
      handler: async ({ uri }, c) => {

        console.log("READ_FILE", uri);

        assertHasWorkspace(c);
        await assertWorkspaceResourceAccess(c, "READ_FILE");

        // Validate URI format
        ResourceUriSchema.parse(uri);

        const resourceId = extractResourceId(uri);
        const filePath = buildFilePath(directory, resourceId);

        try {
          const fileData = await deconfig.READ_FILE({
            path: filePath,
            format: "plainString",
          });

          const content = fileData.content as string;

          // Parse the JSON content
          let parsedData: Record<string, unknown> = {};
          try {
            parsedData = JSON.parse(content);
          } catch {
            throw new UserInputError("Invalid JSON content in resource file");
          }

          // Validate against schema
          const validatedData = dataSchema.parse(parsedData);

          return {
            uri,
            data: validatedData,
            created_at: new Date(fileData.ctime).toISOString(),
            updated_at: new Date(fileData.mtime).toISOString(),
            created_by:
              parsedData &&
              "created_by" in parsedData &&
              typeof parsedData.created_by === "string"
                ? parsedData.created_by
                : undefined,
            updated_by:
              parsedData &&
              "updated_by" in parsedData &&
              typeof parsedData.updated_by === "string"
                ? parsedData.updated_by
                : undefined,
          };
        } catch (error) {
          if (error instanceof Error && error.message.includes("not found")) {
            throw new NotFoundError(`Resource not found: ${uri}`);
          }
          throw error;
        }
      },
    },

    // deco_resource_create (optional)
    {
      description:
        enhancements?.[
          `DECO_RESOURCE_${resourceName.toUpperCase()}_CREATE` as keyof typeof enhancements
        ]?.description ||
        `Create a new ${resourceName} resource in the DECONFIG directory ${directory}`,
      handler: async ({ data }, c) => {
        assertHasWorkspace(c);
        await assertWorkspaceResourceAccess(c, "PUT_FILE");

        // Validate data against schema
        const validatedData = dataSchema.parse(data);

        // Run semantic validation if provided
        if (semanticValidate) {
          await semanticValidate(validatedData, c, deconfig);
        }

        // Extract resource ID from name or generate one
        const resourceId =
          (validatedData.name as string)?.replace(/[^a-zA-Z0-9-_]/g, "-") ||
          crypto.randomUUID();
        const uri = constructResourceUri(
          options.integrationId!, // integrationId
          options.resourceName, // resourceName
          resourceId,
        );
        const filePath = buildFilePath(directory, resourceId);

        // Prepare resource data with metadata
        const resourceData = {
          ...validatedData,
          id: resourceId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: c.user?.id ? String(c.user.id) : undefined,
          updated_by: c.user?.id ? String(c.user.id) : undefined,
        };

        const fileContent = JSON.stringify(resourceData, null, 2);

        await deconfig.PUT_FILE({
          path: filePath,
          content: fileContent,
          metadata: {
            resourceType: resourceName,
            resourceId,
            createdBy: c.user?.id,
            name: validatedData.name || resourceId,
            description: validatedData.description || "",
          },
        });

        return {
          uri,
          data: validatedData,
          created_at: resourceData.created_at,
          updated_at: resourceData.updated_at,
          created_by: c.user?.id ? String(c.user.id) : undefined,
          updated_by: c.user?.id ? String(c.user.id) : undefined,
        };
      },
    },

    // deco_resource_update (optional)
    {
      description:
        enhancements?.[
          `DECO_RESOURCE_${resourceName.toUpperCase()}_UPDATE` as keyof typeof enhancements
        ]?.description ||
        `Update a ${resourceName} resource in the DECONFIG directory ${directory}`,
      handler: async ({ uri, data }, c) => {
        assertHasWorkspace(c);
        await assertWorkspaceResourceAccess(c, "READ_FILE");

        // Validate URI format
        ResourceUriSchema.parse(uri);

        const resourceId = extractResourceId(uri);
        const filePath = buildFilePath(directory, resourceId);

        // Read existing file to get current data
        let existingData: Record<string, unknown> = {};
        try {
          const fileData = await deconfig.READ_FILE({
            path: filePath,
            format: "plainString",
          });
          existingData = JSON.parse(fileData.content as string);
        } catch {
          throw new NotFoundError(`Resource not found: ${uri}`);
        }

        // Validate new data against schema
        const validatedData = dataSchema.parse(data);

        // Run semantic validation if provided
        if (semanticValidate) {
          await semanticValidate(validatedData, c, deconfig);
        }

        // Merge existing data with updates
        const updatedData = {
          ...existingData,
          ...validatedData,
          id: resourceId,
          updated_at: new Date().toISOString(),
          updated_by: c.user?.id ? String(c.user.id) : undefined,
        };

        const fileContent = JSON.stringify(updatedData, null, 2);

        await deconfig.PUT_FILE({
          path: filePath,
          content: fileContent,
          metadata: {
            resourceType: resourceName,
            resourceId,
            updatedBy: c.user?.id,
            name: validatedData.name || resourceId,
            description: validatedData.description || "",
          },
        });

        return {
          uri,
          data: validatedData,
          created_at: existingData.created_at as string,
          updated_at: updatedData.updated_at,
          created_by: existingData.created_by as string,
          updated_by: c.user?.id ? String(c.user.id) : undefined,
        };
      },
    },

    // deco_resource_delete (optional)
    {
      description:
        enhancements?.[
          `DECO_RESOURCE_${resourceName.toUpperCase()}_DELETE` as keyof typeof enhancements
        ]?.description ||
        `Delete a ${resourceName} resource from the DECONFIG directory ${directory}`,
      handler: async ({ uri }, c) => {
        assertHasWorkspace(c);
        await assertWorkspaceResourceAccess(c, "DELETE_FILE");

        // Validate URI format
        ResourceUriSchema.parse(uri);

        const resourceId = extractResourceId(uri);
        const filePath = buildFilePath(directory, resourceId);

        try {
          await deconfig.DELETE_FILE({
            path: filePath,
          });

          return {
            success: true,
            uri,
          };
        } catch (error) {
          if (error instanceof Error && error.message.includes("not found")) {
            throw new NotFoundError(`Resource not found: ${uri}`);
          }
          throw error;
        }
      },
    },
  ]);

  if (group) {
    tools.forEach((tool: { group?: string }) => {
      tool.group = group;
    });
  }

  return tools;
};
