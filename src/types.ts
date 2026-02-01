export type SkillType = 'GIT_FILE' | 'GIT_FOLDER' | 'GIT_REPO' | 'GIST';

export type AgentType =
  | 'antigravity'
  | 'claude-code'
  | 'codex'
  | 'cursor'
  | 'gemini-cli'
  | 'github-copilot';

/**
 * Base skill configuration shared by all types
 */
interface BaseSkillConfig {
  remote: string;
  agents?: AgentType[]; // Which agents to symlink to (all if not specified)
}

/**
 * Configuration for fetching a single file from Git
 */
export interface GitFileConfig extends BaseSkillConfig {
  type: 'GIT_FILE';
  ref?: string; // Git branch, tag, or commit SHA
}

/**
 * Configuration for fetching a folder from Git
 */
export interface GitFolderConfig extends BaseSkillConfig {
  type: 'GIT_FOLDER';
  ref?: string; // Git branch, tag, or commit SHA
}

/**
 * Configuration for cloning an entire Git repository
 */
export interface GitRepoConfig extends BaseSkillConfig {
  type: 'GIT_REPO';
  ref?: string; // Git branch, tag, or commit SHA
}

/**
 * Configuration for fetching a GitHub Gist
 */
export interface GistConfig extends BaseSkillConfig {
  type: 'GIST';
  ref?: string; // Gist revision SHA (optional)
  filename?: string; // Specific file to fetch from multi-file gists
}

/**
 * Discriminated union of all skill configuration types
 */
export type SkillConfig = GitFileConfig | GitFolderConfig | GitRepoConfig | GistConfig;

export interface Config {
  skillsPath: string; // Now non-optional - always set by loadConfig
  skills: Array<{
    [skillName: string]: SkillConfig;
  }>;
}

export interface ParsedGitUrl {
  owner: string;
  repo: string;
  ref?: string;
  path?: string;
  type: 'github' | 'gitlab' | 'bitbucket' | 'generic';
}

export interface FetchResult {
  skillName: string;
  success: boolean;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

/**
 * Metadata stored for each skill to track sync state
 */
export interface SkillMetadata {
  remote: string;
  ref?: string;
  type: SkillType;
  lastSync: string; // ISO timestamp
  contentHash: string; // SHA-256 hash of directory contents
}

/**
 * Result of skip check decision
 */
export interface SkipCheckResult {
  shouldSkip: boolean;
  reason?: string;
  needsInteraction?: boolean;
}

/**
 * Base interface for all fetchers - ensures consistent interface
 *
 * Contract:
 * - Must fetch skill content from remote source
 * - Must save content to skillsPath/skillName directory
 * - Must save metadata after successful fetch
 * - Must throw SkillManagerError on failure (never return error status)
 * - Must clean up any temporary resources on both success and failure
 * - Must validate inputs before making network requests
 */
export interface IFetcher {
  fetch(skillName: string, config: SkillConfig, skillsPath: string): Promise<void>;
}
