import { join } from "node:path/posix";

export type Workspace = `/users/${string}` | `/shared/${string}`;

/**
 * Represents a structured, UNIX-inspired file system for the Webdraw application.
 * This file system provides organized paths for folders and files within the application,
 * serving as a centralized reference for accessing and managing resources.
 *
 * @namespace Paths
 *
 * @property {object} folders - Namespace for folder paths within the Webdraw file system.
 *
 * @property {object} files - Namespace for file paths within the Webdraw file system.
 */
export const Path = {
  root: "/", // Root directory for the Webdraw file system
  separator: "/", // Path separator for the Webdraw file system
  resolveHome: (path: string, homePath: string) => {
    const [woLeadingSlash, absolutePath] = path.startsWith(Path.separator)
      ? [path.slice(1), path]
      : [path, join(Path.root, path)];
    const isFromUserHome = woLeadingSlash.startsWith(Path.folders.home);

    return {
      path: isFromUserHome
        ? join(Path.root, woLeadingSlash.replace(Path.folders.home, homePath))
        : absolutePath,
      resolved: isFromUserHome,
    };
  },
  resolveUserHome: (path: string, userId: string) => {
    return Path.resolveHome(path, Path.folders.users.home(userId));
  },
  folders: {
    trigger: (triggerId: string) =>
      join(Path.folders.triggers(), `${triggerId}`),
    triggers: () => join(Path.root, "triggers"),
    home: "~", // Home directory for the Webdraw file system
    users: {
      home: (userId = "unknown") => join(Path.root, `users/${userId}`),
    },
    Agents: () => join(Path.folders.home, "Agents"),
    Agent: {
      root: (id: string) => join(Path.folders.Agents(), id),
    },
  },
  files: {
    users: {
      home: {
        ".config": {
          sidebar: (userId: string) =>
            join(Path.folders.users.home(userId), ".config", "sidebar.json"),
        },
      },
    },
  },
};

/**
 * Uses the two first segments of the path as the volume name (meaning collaboration)
 */
export const getTwoFirstSegments = (path: string): Workspace =>
  path.split(Path.separator).slice(0, 3).join(Path.separator) as Workspace;
