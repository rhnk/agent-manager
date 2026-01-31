/**
 * Application-wide constants to avoid magic strings and numbers
 */

/** Default skill file name */
export const DEFAULT_SKILL_FILENAME = 'SKILL.md';

/** Default skills base path */
export const DEFAULT_SKILLS_PATH = '~/.claude/skills';

/** Valid skill types */
export const VALID_SKILL_TYPES = ['GIT_FILE', 'GIT_FOLDER', 'GIT_REPO', 'GIST'] as const;

/** Git platforms */
export const GIT_PLATFORMS = {
  GITHUB: 'github',
  GITLAB: 'gitlab',
  BITBUCKET: 'bitbucket',
  GENERIC: 'generic',
} as const;

/** Default Git ref (branch/tag) */
export const DEFAULT_GIT_REF = 'main';

/** Temporary directory prefix */
export const TEMP_DIR_PREFIX = 'skill-manager-';

/** File size limits (in bytes) */
export const FILE_SIZE_LIMITS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50 MB for individual files
  MAX_REPO_SIZE: 200 * 1024 * 1024, // 200 MB for repos
} as const;

/** HTTP request configuration */
export const HTTP_CONFIG = {
  TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
  INITIAL_BACKOFF: 1000, // 1 second
  MAX_BACKOFF: 10000, // 10 seconds
} as const;

/** GitHub API configuration */
export const GITHUB_CONFIG = {
  API_URL: 'https://api.github.com',
  RAW_CONTENT_URL: 'https://raw.githubusercontent.com',
  USER_AGENT: 'skill-manager',
} as const;

/** Gist configuration */
export const GIST_CONFIG = {
  PRIORITY_FILENAMES: [DEFAULT_SKILL_FILENAME] as const,
  MARKDOWN_EXTENSIONS: ['.md', '.markdown'] as const,
} as const;

/** Path validation patterns */
export const PATH_PATTERNS = {
  // Block path traversal attempts
  NO_TRAVERSAL: /\.\./,
  // Allow only safe characters in skill names
  SAFE_NAME: /^[a-zA-Z0-9_-]+$/,
} as const;

/** Error codes for consistent error handling */
export const ERROR_CODES = {
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
  INVALID_CONFIG: 'INVALID_CONFIG',
  INVALID_URL: 'INVALID_URL',
  FETCH_FAILED: 'FETCH_FAILED',
  FILE_SYSTEM_ERROR: 'FILE_SYSTEM_ERROR',
  GIT_ERROR: 'GIT_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  FILE_SIZE_EXCEEDED: 'FILE_SIZE_EXCEEDED',
} as const;
