import { promises as fs, Dirent } from "fs";
import { dirname, join, relative } from "path";
import { createReadStream, createWriteStream } from "fs";
import { pipeline } from "stream/promises";

/**
 * Ensure that a directory exists, creating it if necessary (recursive)
 * Node.js equivalent of Deno's ensureDir
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // If directory already exists, that's fine
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Copy a file from source to destination, creating directories as needed
 */
async function copyFile(src: string, dest: string): Promise<void> {
  await ensureDir(dirname(dest));
  await pipeline(createReadStream(src), createWriteStream(dest));
}

/**
 * Copy a directory recursively from source to destination
 */
async function copyDir(src: string, dest: string, options: CopyOptions = {}): Promise<void> {
  await ensureDir(dest);
  
  const entries = await fs.readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath, options);
    } else if (entry.isFile()) {
      if (!options.overwrite) {
        try {
          await fs.access(destPath);
          continue; // File exists and overwrite is false, skip
        } catch {
          // File doesn't exist, proceed with copy
        }
      }
      await copyFile(srcPath, destPath);
    }
  }
}

export interface CopyOptions {
  overwrite?: boolean;
}

/**
 * Copy a file or directory from source to destination
 * Node.js equivalent of Deno's copy
 */
export async function copy(src: string, dest: string, options: CopyOptions = {}): Promise<void> {
  const srcStat = await fs.stat(src);
  
  if (srcStat.isDirectory()) {
    await copyDir(src, dest, options);
  } else if (srcStat.isFile()) {
    if (!options.overwrite) {
      try {
        await fs.access(dest);
        return; // File exists and overwrite is false, skip
      } catch {
        // File doesn't exist, proceed with copy
      }
    }
    await copyFile(src, dest);
  } else {
    throw new Error(`Source ${src} is neither a file nor a directory`);
  }
}

export interface WalkEntry {
  path: string;
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
}

export interface WalkOptions {
  maxDepth?: number;
  includeFiles?: boolean;
  includeDirs?: boolean;
  followSymlinks?: boolean;
  exts?: string[];
  match?: RegExp[];
  skip?: RegExp[];
}

/**
 * Recursively walk a directory tree and yield entries
 * Node.js equivalent of Deno's walk
 */
export async function* walk(
  root: string,
  options: WalkOptions = {}
): AsyncGenerator<WalkEntry, void, unknown> {
  const {
    maxDepth = Infinity,
    includeFiles = true,
    includeDirs = false,
    followSymlinks = false,
    exts,
    match,
    skip,
  } = options;

  async function* walkRecursive(dir: string, depth: number): AsyncGenerator<WalkEntry, void, unknown> {
    if (depth > maxDepth) return;

    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      // Skip directories we can't read
      return;
    }

    for (const entry of entries) {
      const entryPath = join(dir, entry.name);
      const relativePath = relative(root, entryPath);
      
      let isFile = entry.isFile();
      let isDirectory = entry.isDirectory();
      const isSymlink = entry.isSymbolicLink();

      // Handle symlinks
      if (isSymlink && followSymlinks) {
        try {
          const stat = await fs.stat(entryPath);
          isFile = stat.isFile();
          isDirectory = stat.isDirectory();
        } catch {
          continue; // Skip broken symlinks
        }
      } else if (isSymlink && !followSymlinks) {
        continue; // Skip symlinks when not following them
      }

      const walkEntry: WalkEntry = {
        path: entryPath,
        name: entry.name,
        isFile,
        isDirectory,
        isSymlink,
      };

      // Apply filters
      if (skip && skip.some(pattern => pattern.test(relativePath))) {
        continue;
      }

      if (match && !match.some(pattern => pattern.test(relativePath))) {
        continue;
      }

      if (exts && isFile) {
        const ext = entryPath.substring(entryPath.lastIndexOf('.') + 1);
        if (!exts.includes(ext)) {
          continue;
        }
      }

      // Yield files if requested
      if (isFile && includeFiles) {
        yield walkEntry;
      }

      // Yield directories if requested
      if (isDirectory && includeDirs) {
        yield walkEntry;
      }

      // Recurse into directories
      if (isDirectory) {
        yield* walkRecursive(entryPath, depth + 1);
      }
    }
  }

  yield* walkRecursive(root, 0);
}

/**
 * Collect all walk entries into an array
 * Convenience function for when you need all entries at once
 */
export async function walkArray(root: string, options: WalkOptions = {}): Promise<WalkEntry[]> {
  const entries: WalkEntry[] = [];
  for await (const entry of walk(root, options)) {
    entries.push(entry);
  }
  return entries;
}