import { mimeType } from "@deco/workers-runtime/resources";
import { NotFoundError, UserInputError } from "../../index.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { impl, WellKnownBindings } from "../bindings/binder.ts";
import { createMCPToolsStub, DeconfigClient, MCPClientStub } from "../index.ts";
import z from "zod/v3";

export type ResourcesBinding = (typeof WellKnownBindings)["Resources"];
export type ResourcesTools = ResourcesBinding[number]["name"];

export type EnhancedResourcesTools = Partial<
  Record<
    ResourcesTools,
    {
      description: string;
    }
  >
>;

export interface DeconfigResourceOptions {
  deconfig: DeconfigClient;
  directory: string;
  resourceName?: string;
  enhancements?: EnhancedResourcesTools;
  schema?: z.ZodType;
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
  // Extract ID from URI - expecting format like workflow://resourceId
  const urlParts = uri.split("/");
  const resourceId = urlParts[urlParts.length - 1];
  if (!resourceId) {
    throw new UserInputError("Invalid URI: missing resource ID");
  }
  return resourceId;
};
export const DeconfigResource = {
  define: (options: Omit<DeconfigResourceOptions, "deconfig">) => {
    return {
      client: (deconfig: DeconfigClient): MCPClientStub<ResourcesBinding> => {
        const tools = deconfigResource({
          deconfig,
          ...options,
        });
        return createMCPToolsStub({
          tools,
        }) as MCPClientStub<ResourcesBinding>;
      },
      create: (deconfig: DeconfigClient) => {
        return deconfigResource({
          deconfig,
          ...options,
        });
      },
    };
  },
};

export const deconfigResource = (options: DeconfigResourceOptions) => {
  const {
    deconfig,
    directory,
    resourceName: _resourceName,
    enhancements,
  } = options;
  const resourceName = _resourceName || directory;
  return impl(WellKnownBindings.Resources, [
    // DECO_CHAT_RESOURCES_READ
    {
      description:
        enhancements?.DECO_CHAT_RESOURCES_READ?.description ||
        `Read a resource from the DECONFIG directory ${directory}`,
      handler: async ({ name, uri }, c) => {
        assertHasWorkspace(c);
        await assertWorkspaceResourceAccess(c, "READ_FILE");

        if (name !== resourceName) {
          throw new UserInputError(`Resource name must be '${resourceName}'`);
        }

        const resourceId = extractResourceId(uri);
        const filePath = buildFilePath(directory, resourceId);

        try {
          const fileData = await deconfig.READ_FILE({
            path: filePath,
            format: "plainString",
          });

          const data = fileData.content as string;
          const detectedMimeType = mimeType(filePath) || "application/json";

          // Parse the JSON content to extract title and description
          let parsedData: Record<string, unknown> = {};
          try {
            parsedData = JSON.parse(data);
          } catch {
            // If not valid JSON, treat as plain text
          }

          return {
            name: resourceName,
            uri,
            data,
            type: "text" as const,
            mimeType: detectedMimeType,
            title: String(parsedData.title || parsedData.name || resourceId),
            description: String(
              parsedData.description || `${directory} resource`,
            ),
            timestamp: new Date(fileData.mtime).toISOString(),
            annotations: {
              address: fileData.address,
              ctime: String(fileData.ctime),
              mtime: String(fileData.mtime),
            },
          };
        } catch (error) {
          if (error instanceof Error && error.message.includes("not found")) {
            throw new NotFoundError(`Resource not found: ${uri}`);
          }
          throw error;
        }
      },
    },

    // DECO_CHAT_RESOURCES_SEARCH
    {
      description:
        enhancements?.DECO_CHAT_RESOURCES_SEARCH?.description ||
        `Search resources in the DECONFIG directory ${directory}`,
      handler: async ({ name, term, cursor, limit = 10 }, c) => {
        assertHasWorkspace(c);
        await assertWorkspaceResourceAccess(c, "LIST_FILES");

        if (name !== resourceName) {
          throw new UserInputError(`Resource name must be '${resourceName}'`);
        }

        const normalizedDir = normalizeDirectory(directory);

        // List all files in the directory
        const filesList = await deconfig.LIST_FILES({
          prefix: normalizedDir,
        });

        // Filter files that end with .json and contain the search term
        const allFiles = Object.entries(filesList.files)
          .filter(([path]) => path.endsWith(".json"))
          .map(([path, metadata]) => ({
            path,
            resourceId: path
              .replace(`${normalizedDir}/`, "")
              .replace(".json", ""),
            metadata,
          }));

        // Simple search - filter by resource ID or metadata
        const filteredFiles = allFiles.filter(({ resourceId, path }) => {
          return (
            resourceId.toLowerCase().includes(term.toLowerCase()) ||
            path.toLowerCase().includes(term.toLowerCase())
          );
        });

        // Handle pagination
        const offset = cursor ? parseInt(cursor, 10) : 0;
        const hasMore = filteredFiles.length > offset + limit;
        const items = filteredFiles.slice(offset, offset + limit);

        return {
          items: items.map(({ resourceId, metadata }) => ({
            name: resourceName,
            uri: `${resourceName}://${resourceId}`,
            title: resourceId,
            description: `${directory} resource`,
            mimeType: "application/json",
            timestamp: new Date(metadata.mtime).toISOString(),
            size: metadata.sizeInBytes,
          })),
          hasMore,
          nextCursor: hasMore ? String(offset + limit) : undefined,
        };
      },
    },

    // DECO_CHAT_RESOURCES_CREATE
    {
      description:
        enhancements?.DECO_CHAT_RESOURCES_CREATE?.description ||
        `Create a new resource in the DECONFIG directory ${directory}`,
      handler: async (
        { name, resourceName: rsName, title, description, content, metadata },
        c,
      ) => {
        assertHasWorkspace(c);
        await assertWorkspaceResourceAccess(c, "PUT_FILE");

        if (name !== resourceName) {
          throw new UserInputError(`Resource name must be '${resourceName}'`);
        }

        const resourceId = rsName || crypto.randomUUID();
        const uri = `${resourceName}://${resourceId}`;
        const filePath = buildFilePath(directory, resourceId);

        // Parse content data
        let resourceData: Record<string, unknown> = {};
        if (content) {
          try {
            resourceData =
              content.type === "text"
                ? JSON.parse(content.data)
                : { data: content.data, type: content.type };
          } catch {
            resourceData = { data: content.data };
          }
        }

        // Merge all data
        const finalData = {
          id: resourceId,
          name: rsName || resourceId,
          title,
          description,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...resourceData,
          ...metadata,
        };

        if (options.schema) {
          options.schema.parse(finalData);
        }

        const fileContent = JSON.stringify(finalData, null, 2);

        await deconfig.PUT_FILE({
          path: filePath,
          content: fileContent,
          metadata: {
            resourceType: directory,
            resourceId,
            ...metadata,
          },
        });

        return {
          name: resourceName,
          uri,
          title: title || rsName || resourceId,
          description: description || `${directory} resource`,
          mimeType: "application/json",
        };
      },
    },

    // DECO_CHAT_RESOURCES_UPDATE
    {
      description:
        enhancements?.DECO_CHAT_RESOURCES_UPDATE?.description ||
        `Update a resource in the DECONFIG directory ${directory}`,
      handler: async (
        {
          name,
          uri,
          resourceName: rsName,
          title,
          description,
          content,
          metadata,
        },
        c,
      ) => {
        assertHasWorkspace(c);
        await assertWorkspaceResourceAccess(c, "READ_FILE");

        if (name !== resourceName) {
          throw new UserInputError(`Resource name must be '${resourceName}'`);
        }

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
          // File doesn't exist or is not valid JSON, start with empty object
        }

        // Parse new content data
        let parsedData: Record<string, unknown> = {};
        if (content) {
          try {
            parsedData =
              content.type === "text"
                ? JSON.parse(content.data)
                : { data: content.data, type: content.type };
          } catch {
            parsedData = { data: content.data };
          }
        }

        // Merge existing data with updates
        const updatedData: Record<string, unknown> = {
          ...existingData,
          ...parsedData,
          ...metadata,
          updated_at: new Date().toISOString(),
        };

        if (rsName) updatedData.name = rsName;
        if (title) updatedData.title = title;
        if (description) updatedData.description = description;

        if (options.schema) {
          options.schema.parse(updatedData);
        }
        const fileContent = JSON.stringify(updatedData, null, 2);

        await deconfig.PUT_FILE({
          path: filePath,
          content: fileContent,
          metadata: {
            resourceType: directory,
            resourceId,
            ...metadata,
          },
        });

        return {
          name: resourceName,
          uri,
          title: title || rsName || resourceId,
          description: description || `${directory} resource`,
          mimeType: "application/json",
        };
      },
    },

    // DECO_CHAT_RESOURCES_DELETE
    {
      description:
        enhancements?.DECO_CHAT_RESOURCES_DELETE?.description ||
        `Delete a resource from the DECONFIG directory ${directory}`,
      handler: async ({ name, uri }, c) => {
        assertHasWorkspace(c);
        await assertWorkspaceResourceAccess(c, "DELETE_FILE");

        if (name !== resourceName) {
          throw new UserInputError(`Resource name must be '${resourceName}'`);
        }

        const resourceId = extractResourceId(uri);
        const filePath = buildFilePath(directory, resourceId);

        await deconfig.DELETE_FILE({
          path: filePath,
        });

        return {
          deletedUri: uri,
        };
      },
    },

    // DECO_CHAT_RESOURCES_LIST
    {
      description:
        enhancements?.DECO_CHAT_RESOURCES_LIST?.description ||
        `List available resource types`,
      handler: async (_, c) => {
        assertHasWorkspace(c);
        await assertWorkspaceResourceAccess(c, "LIST_FILES");

        return {
          resources: [
            {
              name: resourceName,
              icon: "folder",
              title:
                resourceName.charAt(0).toUpperCase() + resourceName.slice(1),
              description: `DECONFIG resourceName: ${resourceName}`,
              hasCreate: true,
              hasUpdate: true,
              hasDelete: true,
            },
          ],
        };
      },
    },
  ]);
};
