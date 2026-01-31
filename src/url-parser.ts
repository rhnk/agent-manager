import { ParsedGitUrl } from './types';
import { validateGistUrl, validateGitUrl } from './validation';
import { SkillManagerError } from './errors';
import { DEFAULT_GIT_REF, ERROR_CODES, GIT_PLATFORMS, GITHUB_CONFIG } from './constants';

/**
 * Resolve Git ref (branch, tag, or commit SHA) from multiple sources with precedence
 * Priority: config ref > url ref > default 'main'
 * @param configRef Ref from configuration
 * @param urlRef Ref parsed from URL
 * @returns Resolved ref string
 */
export function resolveRef(configRef: string | undefined, urlRef: string | undefined): string {
  if (configRef) {
    return configRef;
  }
  if (urlRef) {
    return urlRef;
  }
  return DEFAULT_GIT_REF;
}

/**
 * Build full repository URL from parsed Git components
 * @param parsed Parsed Git URL components
 * @returns Full repository HTTPS URL
 * @throws SkillManagerError if URL building fails
 */
export function buildRepositoryUrl(parsed: ParsedGitUrl): string {
  const host = parsed.type === GIT_PLATFORMS.GITHUB ? 'github.com' : `${parsed.type}.com`;
  return `https://${host}/${parsed.owner}/${parsed.repo}.git`;
}

/**
 * Parse a Git repository URL and extract components
 * @param url The URL to parse (supports HTTPS and SSH formats)
 * @param type The type of Git resource (GIT_FILE, GIT_FOLDER, or GIT_REPO)
 * @returns Parsed URL components
 * @throws SkillManagerError if URL parsing fails
 */
export function parseGitUrl(
  url: string,
  type: 'GIT_FILE' | 'GIT_FOLDER' | 'GIT_REPO'
): ParsedGitUrl {
  // Validate input
  validateGitUrl(url, type);

  // Normalize URL
  url = url.trim();

  // Detect platform
  let platform: 'github' | 'gitlab' | 'bitbucket' | 'generic' = 'generic';
  if (url.includes('github.com')) {
    platform = 'github';
  } else if (url.includes('gitlab.com')) {
    platform = 'gitlab';
  } else if (url.includes('bitbucket.org')) {
    platform = 'bitbucket';
  }

  // Convert SSH to HTTPS for easier parsing
  if (url.startsWith('git@')) {
    url = url.replace('git@', 'https://').replace('.com:', '.com/').replace('.org:', '.org/');
  }

  // Remove .git suffix if present
  url = url.replace(/\.git$/, '');

  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter((p) => p);

    if (pathParts.length < 2) {
      throw new Error('Must contain owner and repo');
    }

    const owner = pathParts[0];
    const repo = pathParts[1];

    let ref: string | undefined;
    let path: string | undefined;

    // Parse path based on type for GitHub (other platforms may have different structures)
    if (
      type === 'GIT_FILE' &&
      platform === 'github' &&
      pathParts[2] === 'blob' &&
      pathParts.length > 4
    ) {
      ref = pathParts[3];
      path = pathParts.slice(4).join('/');
    } else if (
      type === 'GIT_FOLDER' &&
      platform === 'github' &&
      pathParts[2] === 'tree' &&
      pathParts.length > 4
    ) {
      ref = pathParts[3];
      path = pathParts.slice(4).join('/');
    } else if (pathParts.length > 2 && (type === 'GIT_FILE' || type === 'GIT_FOLDER')) {
      path = pathParts.slice(2).join('/');
    }

    return {
      owner,
      repo,
      ref,
      path,
      type: platform,
    };
  } catch (error) {
    throw new SkillManagerError(
      `Failed to parse Git URL: ${error instanceof Error ? error.message : String(error)}`,
      ERROR_CODES.INVALID_URL,
      { url: url.substring(0, 100), type },
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Parse a GitHub Gist URL and extract the Gist ID
 * @param url The Gist URL to parse
 * @returns The Gist ID
 * @throws SkillManagerError if URL parsing fails
 */
export function parseGistUrl(url: string): string {
  // Validate input
  validateGistUrl(url);

  const match = url.match(/gist\.github\.com\/(?:[\w-]+\/)?([\w]+)/);
  if (!match || !match[1]) {
    throw new SkillManagerError('Could not extract Gist ID from URL', ERROR_CODES.INVALID_URL, {
      url: url.substring(0, 100),
    });
  }

  return match[1];
}

/**
 * Build a raw content URL for GitHub files
 * Useful for fetching raw file content via HTTPS
 * @param parsed Parsed Git URL components
 * @param filepath Optional filepath to override the one in parsed
 * @returns Raw content URL
 * @throws SkillManagerError if URL building is not supported for the platform
 */
export function buildRawUrl(parsed: ParsedGitUrl, filepath?: string): string {
  if (parsed.type === 'github') {
    const ref = parsed.ref || DEFAULT_GIT_REF;
    const path = filepath || parsed.path || '';
    return `${GITHUB_CONFIG.RAW_CONTENT_URL}/${parsed.owner}/${parsed.repo}/${ref}/${path}`;
  }

  throw new SkillManagerError(
    `Raw URL generation not supported for platform: ${parsed.type}`,
    ERROR_CODES.INVALID_URL,
    { platform: parsed.type }
  );
}
