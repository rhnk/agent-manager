import { GITHUB_CONFIG } from './constants';

/**
 * Get GitHub authentication headers
 * Includes token if GITHUB_TOKEN environment variable is set
 * @returns Headers object for fetch requests
 */
export function getGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': GITHUB_CONFIG.USER_AGENT,
  };

  // Add authentication token if available
  const token = process.env[GITHUB_CONFIG.TOKEN_ENV_VAR];
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  return headers;
}

/**
 * Check if GitHub token is configured
 * @returns True if GITHUB_TOKEN environment variable is set
 */
export function hasGitHubToken(): boolean {
  return !!process.env[GITHUB_CONFIG.TOKEN_ENV_VAR];
}
