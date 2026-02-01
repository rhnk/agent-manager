import simpleGit from 'simple-git';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
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
import { withRetry } from '../retry';
import { validateFilePath } from '../validation';
import { calculateContentHash, saveMetadata } from '../metadata-manager';

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

  // Create temporary directory using fs.mkdtemp for security
  const tempBase = path.join(os.tmpdir(), TEMP_DIR_PREFIX);
  let tempDir: string;

  try {
    tempDir = await fs.mkdtemp(tempBase);
  } catch (error) {
    throw new SkillManagerError(
      'Failed to create temporary directory',
      ERROR_CODES.FILE_SYSTEM_ERROR,
      { tempBase },
      error instanceof Error ? error : undefined
    );
  }

  try {
    const git = simpleGit();

    // Build repository URL from parsed components (DRY improvement)
    const repoUrl = buildRepositoryUrl(parsed);

    // For commit SHAs, we need to clone without depth and then checkout
    // Commit SHAs can be short (7+ chars) or full (40 for SHA-1, 64 for SHA-256)
    const isCommitSha = /^[0-9a-fA-F]{7,}$/.test(ref);

    // Clone the repository with retry logic
    // Note: Cannot use --depth with commit SHAs, only with branches/tags
    if (isCommitSha) {
      // For commit SHA: clone without depth restriction, then checkout
      await withRetry(() => git.clone(repoUrl, tempDir), `Cloning ${repoUrl}`, { maxRetries: 3 });

      // Checkout the specific commit
      const repoGit = simpleGit(tempDir);
      await repoGit.checkout(ref);
    } else {
      // For branches/tags: use shallow clone with --depth=1
      await withRetry(
        () => git.clone(repoUrl, tempDir, ['--depth', '1', '--branch', ref]),
        `Cloning ${repoUrl}`,
        { maxRetries: 3 }
      );
    }

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

    // Save metadata for skip checking on next sync
    await saveMetadata(skillDir, {
      remote: config.remote,
      ref: ref,
      type: config.type,
      lastSync: new Date().toISOString(),
      contentHash: await calculateContentHash(skillDir),
    });
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
