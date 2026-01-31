import simpleGit from 'simple-git';
import path from 'path';
import os from 'os';
import { buildRepositoryUrl, parseGitUrl, resolveRef } from '../url-parser';
import {
  clearDirectory,
  copyDirectory,
  ensureSkillDirectory,
  removeDirectory,
} from '../file-manager';
import { SkillConfig } from '../types';
import { SkillManagerError, wrapError } from '../errors';
import { ERROR_CODES, TEMP_DIR_PREFIX } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import { withRetry } from '../retry';
import { validateFilePath } from '../validation';

/**
 * Fetch a specific folder from a Git repository
 * @param skillName Name of the skill
 * @param config Skill configuration
 * @param skillsPath Base path for skills
 * @throws SkillManagerError if fetch fails
 */
export async function fetchGitFolder(
  skillName: string,
  config: SkillConfig,
  skillsPath: string
): Promise<void> {
  const parsed = parseGitUrl(config.remote, 'GIT_FOLDER');

  if (!parsed.path) {
    throw new SkillManagerError(
      `GIT_FOLDER URL must include a folder path: ${config.remote}`,
      ERROR_CODES.INVALID_URL,
      { remote: config.remote, hasPath: !!parsed.path }
    );
  }

  // Resolve ref with precedence: config > url > default
  const ref = resolveRef(config.ref, parsed.ref);

  // Create temporary directory with unique UUID to prevent race conditions
  const uniqueId = uuidv4();
  const tempDir = path.join(os.tmpdir(), `${TEMP_DIR_PREFIX}${Date.now()}-${uniqueId}`);

  try {
    const git = simpleGit();

    // Build repository URL from parsed components (DRY improvement)
    const repoUrl = buildRepositoryUrl(parsed);

    // Clone the repository with retry logic
    await withRetry(
      () => git.clone(repoUrl, tempDir, ['--depth', '1', '--branch', ref]),
      `Cloning ${repoUrl}`,
      { maxRetries: 3 }
    );

    // Path to the folder within the cloned repo
    const sourcePath = path.join(tempDir, parsed.path);

    // Validate the source path is within temp directory (security)
    validateFilePath(tempDir, sourcePath);

    // Ensure skill directory exists and clear it
    const skillDir = await ensureSkillDirectory(skillsPath, skillName);
    await clearDirectory(skillDir);

    // Validate skill directory is safe
    validateFilePath(skillsPath, skillDir);

    // Copy the folder contents
    await copyDirectory(sourcePath, skillDir);
  } catch (error) {
    if (error instanceof SkillManagerError) {
      throw error;
    }
    throw wrapError(
      error,
      `Failed to fetch Git folder for skill "${skillName}"`,
      ERROR_CODES.GIT_ERROR,
      { skillName, remote: config.remote, ref }
    );
  } finally {
    // Clean up temp directory
    try {
      await removeDirectory(tempDir);
    } catch (cleanupError) {
      // Log cleanup error but don't throw - we don't want to mask the original error
      console.warn(`Failed to clean up temporary directory ${tempDir}:`, cleanupError);
    }
  }
}
