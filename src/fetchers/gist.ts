import fetch from 'node-fetch';
import { parseGistUrl } from '../url-parser';
import { ensureSkillDirectory, writeSkillFile } from '../file-manager';
import { SkillConfig } from '../types';
import { SkillManagerError, wrapError } from '../errors';
import {
  DEFAULT_SKILL_FILENAME,
  ERROR_CODES,
  FILE_SIZE_LIMITS,
  GIST_CONFIG,
  GITHUB_CONFIG,
} from '../constants';
import { withRetryAndTimeout } from '../retry';
import { validateFileSize, validateTrustedUrl } from '../validation';

interface GistFile {
  filename: string;
  content: string;
  raw_url: string;
}

interface GistResponse {
  files: {
    [key: string]: GistFile;
  };
}

/**
 * Fetch a GitHub Gist
 * @param skillName Name of the skill
 * @param config Skill configuration
 * @param skillsPath Base path for skills
 * @throws SkillManagerError if fetch fails
 */
export async function fetchGist(
  skillName: string,
  config: SkillConfig,
  skillsPath: string
): Promise<void> {
  try {
    const gistId = parseGistUrl(config.remote);

    // Build API URL with optional revision
    const apiUrl = config.ref
      ? `${GITHUB_CONFIG.API_URL}/gists/${gistId}/${config.ref}`
      : `${GITHUB_CONFIG.API_URL}/gists/${gistId}`;

    // Validate URL is from trusted source
    validateTrustedUrl(apiUrl);

    // Fetch gist data from GitHub API with retry and timeout
    const response = await withRetryAndTimeout(
      () =>
        fetch(apiUrl, {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': GITHUB_CONFIG.USER_AGENT,
          },
        }),
      `Fetching Gist ${gistId}`,
      { maxRetries: 3 }
    );

    if (!response.ok) {
      throw new SkillManagerError(
        `Failed to fetch Gist: ${response.status} ${response.statusText}`,
        ERROR_CODES.FETCH_FAILED,
        { gistId, status: response.status, statusText: response.statusText }
      );
    }

    const gist = (await response.json()) as GistResponse;

    // Find the target file based on priority:
    // 1. Specific filename if provided in config
    // 2. SKILL.md if it exists
    // 3. First .md file
    let targetFile: GistFile | undefined;

    if (config.filename) {
      // Use specific filename from config
      targetFile = gist.files[config.filename];
      if (!targetFile) {
        throw new SkillManagerError(
          `File "${config.filename}" not found in Gist`,
          ERROR_CODES.FETCH_FAILED,
          { gistId, filename: config.filename, availableFiles: Object.keys(gist.files) }
        );
      }
    } else if (gist.files[DEFAULT_SKILL_FILENAME]) {
      // Default to SKILL.md if it exists
      targetFile = gist.files[DEFAULT_SKILL_FILENAME];
    } else {
      // Fall back to first .md file
      const mdFiles = Object.values(gist.files).filter((file) =>
        GIST_CONFIG.MARKDOWN_EXTENSIONS.some((ext) => file.filename.toLowerCase().endsWith(ext))
      );

      if (mdFiles.length > 0) {
        targetFile = mdFiles[0];
      }
    }

    if (!targetFile) {
      throw new SkillManagerError(`No markdown file found in Gist`, ERROR_CODES.FETCH_FAILED, {
        gistId,
        availableFiles: Object.keys(gist.files),
        expectedExtensions: GIST_CONFIG.MARKDOWN_EXTENSIONS,
      });
    }

    // Validate content size
    const contentSizeBytes = Buffer.byteLength(targetFile.content, 'utf-8');
    validateFileSize(contentSizeBytes, FILE_SIZE_LIMITS.MAX_FILE_SIZE);

    // Ensure skill directory exists and write SKILL.md
    const skillDir = await ensureSkillDirectory(skillsPath, skillName);
    await writeSkillFile(skillDir, DEFAULT_SKILL_FILENAME, targetFile.content);
  } catch (error) {
    if (error instanceof SkillManagerError) {
      throw error;
    }
    throw wrapError(
      error,
      `Failed to fetch Gist for skill "${skillName}"`,
      ERROR_CODES.FETCH_FAILED,
      { skillName, remote: config.remote }
    );
  }
}
