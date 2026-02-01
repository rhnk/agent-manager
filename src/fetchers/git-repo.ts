import simpleGit from 'simple-git';
import path from 'path';
import fs from 'fs-extra';
import { buildRepositoryUrl, parseGitUrl, resolveRef } from '../url-parser';
import { clearDirectory, ensureSkillDirectory, removeDirectory } from '../file-manager';
import { SkillConfig } from '../types';
import { SkillManagerError, wrapError } from '../errors';
import { ERROR_CODES } from '../constants';
import { withRetry } from '../retry';
import { validateFilePath } from '../validation';
import { calculateContentHash, saveMetadata } from '../metadata-manager';

/**
 * Fetch an entire Git repository
 * @param skillName Name of the skill
 * @param config Skill configuration
 * @param skillsPath Base path for skills
 * @throws SkillManagerError if fetch fails
 */
export async function fetchGitRepo(
  skillName: string,
  config: SkillConfig,
  skillsPath: string
): Promise<void> {
  try {
    const parsed = parseGitUrl(config.remote, 'GIT_REPO');

    // Resolve ref with precedence: config > default
    const ref = resolveRef(config.ref, undefined);

    // Ensure skill directory exists and clear it
    const skillDir = await ensureSkillDirectory(skillsPath, skillName);
    await clearDirectory(skillDir);

    // Validate skill directory is safe
    validateFilePath(skillsPath, skillDir);

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
      await withRetry(() => git.clone(repoUrl, skillDir), `Cloning ${repoUrl}`, { maxRetries: 3 });

      // Checkout the specific commit
      const repoGit = simpleGit(skillDir);
      await repoGit.checkout(ref);
    } else {
      // For branches/tags: use shallow clone with --depth=1
      await withRetry(
        () => git.clone(repoUrl, skillDir, ['--depth', '1', '--branch', ref]),
        `Cloning ${repoUrl}`,
        { maxRetries: 3 }
      );
    }

    // Remove .git directory to avoid nested repos and reduce size
    const gitDir = path.join(skillDir, '.git');
    if (await fs.pathExists(gitDir)) {
      await removeDirectory(gitDir);
    }

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
      `Failed to fetch Git repository for skill "${skillName}"`,
      ERROR_CODES.GIT_ERROR,
      { skillName, remote: config.remote }
    );
  }
}
