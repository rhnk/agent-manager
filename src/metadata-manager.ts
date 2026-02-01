import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { SkillMetadata } from './types';
import { ERROR_CODES, METADATA_FILENAME } from './constants';
import { wrapError } from './errors';
import { pipeline } from 'stream/promises';

/**
 * Check if metadata file exists for a skill
 * @param skillDir Path to skill directory
 * @returns True if metadata exists
 */
export async function metadataExists(skillDir: string): Promise<boolean> {
  const metadataPath = path.join(skillDir, METADATA_FILENAME);
  return await fs.pathExists(metadataPath);
}

/**
 * Load metadata from skill directory
 * @param skillDir Path to skill directory
 * @returns Skill metadata or null if not found/invalid
 */
export async function loadMetadata(skillDir: string): Promise<SkillMetadata | null> {
  try {
    const metadataPath = path.join(skillDir, METADATA_FILENAME);

    if (!(await fs.pathExists(metadataPath))) {
      return null;
    }

    const content = await fs.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(content) as SkillMetadata;

    // Validate required fields
    if (!metadata.remote || !metadata.type || !metadata.lastSync || !metadata.contentHash) {
      console.warn(`Invalid metadata in ${metadataPath}, missing required fields`);
      return null;
    }

    return metadata;
  } catch (error) {
    // If JSON parse fails or any other error, return null (will trigger re-sync)
    console.warn(`Failed to load metadata from ${skillDir}:`, error);
    return null;
  }
}

/**
 * Save metadata to skill directory
 * @param skillDir Path to skill directory
 * @param metadata Metadata to save
 * @throws SkillManagerError if save fails
 */
export async function saveMetadata(skillDir: string, metadata: SkillMetadata): Promise<void> {
  try {
    const metadataPath = path.join(skillDir, METADATA_FILENAME);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
  } catch (error) {
    throw wrapError(
      error,
      `Failed to save metadata to ${skillDir}`,
      ERROR_CODES.FILE_SYSTEM_ERROR,
      { skillDir }
    );
  }
}

/**
 * Calculate SHA-256 hash of a single file using streaming
 * More memory efficient for large files
 * @param filePath Path to the file
 * @returns SHA-256 hash string
 */
async function hashFile(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);

  try {
    await pipeline(stream, hash);
    return hash.digest('hex');
  } catch (error) {
    throw wrapError(error, `Failed to hash file ${filePath}`, ERROR_CODES.FILE_SYSTEM_ERROR, {
      filePath,
    });
  }
}

/**
 * Calculate SHA-256 hash of all files in a directory
 * Excludes the metadata file itself to avoid circular dependencies
 * Uses streaming for memory efficiency
 * @param skillDir Path to skill directory
 * @returns SHA-256 hash string
 */
export async function calculateContentHash(skillDir: string): Promise<string> {
  try {
    const hash = crypto.createHash('sha256');

    // Get all files recursively, excluding metadata file
    const files = await getAllFiles(skillDir);

    // Sort for deterministic hashing
    files.sort();

    // Hash each file's content and path using streaming
    for (const file of files) {
      const relativePath = path.relative(skillDir, file);

      // Skip metadata file
      if (relativePath === METADATA_FILENAME) {
        continue;
      }

      // Hash the file path (for structure changes)
      hash.update(relativePath);

      // Hash the file content using streaming
      const fileHash = await hashFile(file);
      hash.update(fileHash);
    }

    return hash.digest('hex');
  } catch (error) {
    throw wrapError(
      error,
      `Failed to calculate content hash for ${skillDir}`,
      ERROR_CODES.FILE_SYSTEM_ERROR,
      { skillDir }
    );
  }
}

/**
 * Recursively get all files in a directory
 * @param dir Directory to scan
 * @returns Array of file paths
 */
async function getAllFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip .git directories and other hidden dirs that might be large
        if (!entry.name.startsWith('.')) {
          const subFiles = await getAllFiles(fullPath);
          files.push(...subFiles);
        }
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // If directory doesn't exist or can't be read, return empty array
    console.warn(`Failed to read directory ${dir}:`, error);
  }

  return files;
}
