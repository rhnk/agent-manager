import fetch from 'node-fetch';
import { buildRawUrl, parseGitUrl, resolveRef } from '../url-parser';
import { ensureSkillDirectory, writeSkillFile } from '../file-manager';
import { SkillConfig } from '../types';
import { SkillManagerError, wrapError } from '../errors';
import { DEFAULT_SKILL_FILENAME, ERROR_CODES, FILE_SIZE_LIMITS } from '../constants';
import { withRetryAndTimeout } from '../retry';
import { validateFileSize, validateTrustedUrl } from '../validation';
import { calculateContentHash, saveMetadata } from '../metadata-manager';
import { getGitHubHeaders } from '../github-auth';
import { getAgentForUrl } from '../http-agent';

/**
 * Fetch a single file from a Git repository
 * @param skillName Name of the skill
 * @param config Skill configuration
 * @param skillsPath Base path for skills
 * @throws SkillManagerError if fetch fails
 */
export async function fetchGitFile(
  skillName: string,
  config: SkillConfig,
  skillsPath: string
): Promise<void> {
  try {
    const parsed = parseGitUrl(config.remote, 'GIT_FILE');

    if (!parsed.path) {
      throw new SkillManagerError(
        `GIT_FILE URL must include a file path: ${config.remote}`,
        ERROR_CODES.INVALID_URL,
        { remote: config.remote, hasPath: !!parsed.path }
      );
    }

    // Resolve ref with precedence: config > url > default
    const ref = resolveRef(config.ref, parsed.ref);
    const updatedParsed = { ...parsed, ref };

    // Build raw URL for the file
    const rawUrl = buildRawUrl(updatedParsed);

    // Validate URL is from trusted source
    validateTrustedUrl(rawUrl);

    // Fetch the file content with retry and timeout
    const response = await withRetryAndTimeout(
      () => fetch(rawUrl, { headers: getGitHubHeaders(), agent: getAgentForUrl(rawUrl) }),
      `Fetching file from ${rawUrl}`
    );

    if (!response.ok) {
      throw new SkillManagerError(
        `Failed to fetch file: ${response.status} ${response.statusText}`,
        ERROR_CODES.FETCH_FAILED,
        { url: rawUrl, status: response.status, statusText: response.statusText }
      );
    }

    // Check content length before reading
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const sizeBytes = parseInt(contentLength, 10);
      validateFileSize(sizeBytes, FILE_SIZE_LIMITS.MAX_FILE_SIZE);
    }

    const content = await response.text();

    // Double-check content size
    const contentSizeBytes = Buffer.byteLength(content, 'utf-8');
    validateFileSize(contentSizeBytes, FILE_SIZE_LIMITS.MAX_FILE_SIZE);

    // Ensure skill directory exists and write SKILL.md
    const skillDir = await ensureSkillDirectory(skillsPath, skillName);
    await writeSkillFile(skillDir, DEFAULT_SKILL_FILENAME, content);

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
      `Failed to fetch Git file for skill "${skillName}"`,
      ERROR_CODES.FETCH_FAILED,
      { skillName, remote: config.remote }
    );
  }
}
