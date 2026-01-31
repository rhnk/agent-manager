import path from 'path';
import { ERROR_CODES, FILE_SIZE_LIMITS, PATH_PATTERNS } from './constants';
import { SkillManagerError } from './errors';

/**
 * Sanitize and validate skill name to prevent path traversal
 */
export function sanitizeSkillName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new SkillManagerError(
      'Skill name must be a non-empty string',
      ERROR_CODES.VALIDATION_ERROR,
      { skillName: name }
    );
  }

  // Check for path traversal attempts
  if (PATH_PATTERNS.NO_TRAVERSAL.test(name)) {
    throw new SkillManagerError(
      'Skill name contains invalid characters (path traversal detected)',
      ERROR_CODES.VALIDATION_ERROR,
      { skillName: name }
    );
  }

  // Trim whitespace
  const trimmed = name.trim();

  // Validate against safe characters pattern
  if (!PATH_PATTERNS.SAFE_NAME.test(trimmed)) {
    throw new SkillManagerError(
      'Skill name contains invalid characters. Use only alphanumeric, hyphens, and underscores',
      ERROR_CODES.VALIDATION_ERROR,
      { skillName: trimmed, pattern: PATH_PATTERNS.SAFE_NAME.source }
    );
  }

  return trimmed;
}

/**
 * Validate file path is within expected directory (prevent directory traversal)
 */
export function validateFilePath(basePath: string, targetPath: string): void {
  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(targetPath);

  // Ensure target is within base path
  if (!resolvedTarget.startsWith(resolvedBase)) {
    throw new SkillManagerError(
      'Invalid file path: resolves outside base directory',
      ERROR_CODES.VALIDATION_ERROR,
      { basePath: resolvedBase, targetPath: resolvedTarget }
    );
  }
}

/**
 * Validate file size doesn't exceed limits
 */
export function validateFileSize(
  sizeBytes: number,
  limitBytes: number = FILE_SIZE_LIMITS.MAX_FILE_SIZE
): void {
  if (sizeBytes > limitBytes) {
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
    const limitMB = (limitBytes / (1024 * 1024)).toFixed(2);
    throw new SkillManagerError(
      `File size ${sizeMB}MB exceeds maximum allowed size ${limitMB}MB`,
      ERROR_CODES.FILE_SIZE_EXCEEDED,
      { fileSizeMB: sizeMB, limitMB }
    );
  }
}

/**
 * Validate URL is from a trusted domain (prevent arbitrary code execution)
 */
export function validateTrustedUrl(url: string, allowedDomains?: string[]): void {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Default allowed domains if not specified
    const defaults = [
      'github.com',
      'gist.github.com',
      'raw.githubusercontent.com',
      'api.github.com',
    ];
    const allowed = allowedDomains ? [...defaults, ...allowedDomains] : defaults;

    if (!allowed.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
      throw new SkillManagerError(
        `URL domain not in trusted list: ${hostname}`,
        ERROR_CODES.VALIDATION_ERROR,
        { hostname, allowedDomains: allowed }
      );
    }
  } catch (error) {
    if (error instanceof SkillManagerError) throw error;
    throw new SkillManagerError(
      `Invalid URL format: ${url}`,
      ERROR_CODES.INVALID_URL,
      { url: url.substring(0, 100) }, // Truncate for logging
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Validate Git URL format and extract components safely
 */
export function validateGitUrl(url: string, type: 'GIT_FILE' | 'GIT_FOLDER' | 'GIT_REPO'): void {
  // Validate URL structure
  if (!url || typeof url !== 'string') {
    throw new SkillManagerError('Git URL must be a non-empty string', ERROR_CODES.INVALID_URL, {
      url,
      type,
    });
  }

  const trimmed = url.trim();

  // Check for common URL formats
  if (
    !trimmed.includes('github.com') &&
    !trimmed.includes('gitlab.com') &&
    !trimmed.includes('bitbucket.org')
  ) {
    throw new SkillManagerError(
      'Only GitHub, GitLab, and Bitbucket are supported. URL must contain one of these domains',
      ERROR_CODES.INVALID_URL,
      { url: trimmed.substring(0, 100), type }
    );
  }

  // Try to parse as URL
  try {
    const urlObj = new URL(
      trimmed.replace('git@', 'https://').replace('.com:', '.com/').replace('.org:', '.org/')
    );
    const pathParts = urlObj.pathname.split('/').filter((p) => p);

    if (pathParts.length < 2) {
      throw new Error('Must contain owner and repo');
    }

    // Validate specific requirements for file/folder
    if (type === 'GIT_FILE' && trimmed.includes('blob')) {
      if (!trimmed.includes('/blob/')) {
        throw new Error('GIT_FILE URL must contain /blob/ path component');
      }
    }

    if (type === 'GIT_FOLDER' && trimmed.includes('tree')) {
      if (!trimmed.includes('/tree/')) {
        throw new Error('GIT_FOLDER URL must contain /tree/ path component');
      }
    }
  } catch (error) {
    throw new SkillManagerError(
      `Invalid Git URL: ${error instanceof Error ? error.message : String(error)}`,
      ERROR_CODES.INVALID_URL,
      { url: trimmed.substring(0, 100), type },
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Validate Gist URL format
 */
export function validateGistUrl(url: string): void {
  if (!url || typeof url !== 'string') {
    throw new SkillManagerError('Gist URL must be a non-empty string', ERROR_CODES.INVALID_URL, {
      url,
    });
  }

  if (!url.includes('gist.github.com')) {
    throw new SkillManagerError(
      'Invalid Gist URL: must be from gist.github.com',
      ERROR_CODES.INVALID_URL,
      { url: url.substring(0, 100) }
    );
  }

  // Try to extract gist ID
  const match = url.match(/gist\.github\.com\/(?:[\w-]+\/)?([\w]+)/);
  if (!match || !match[1]) {
    throw new SkillManagerError('Could not extract Gist ID from URL', ERROR_CODES.INVALID_URL, {
      url: url.substring(0, 100),
    });
  }
}

/**
 * Validate filename exists in allowed list
 */
export function validateFilename(
  filename: string,
  allowedExtensions: string[] = ['.md', '.markdown']
): void {
  if (!filename || typeof filename !== 'string') {
    throw new SkillManagerError(
      'Filename must be a non-empty string',
      ERROR_CODES.VALIDATION_ERROR,
      { filename }
    );
  }

  const hasAllowedExtension = allowedExtensions.some((ext) => filename.toLowerCase().endsWith(ext));
  if (!hasAllowedExtension) {
    throw new SkillManagerError(
      `Filename must have one of these extensions: ${allowedExtensions.join(', ')}`,
      ERROR_CODES.VALIDATION_ERROR,
      { filename, allowedExtensions }
    );
  }
}
