import fs from 'fs-extra';
import path from 'path';
import { Config } from './types';
import os from 'os';
import { DEFAULT_SKILLS_PATH, ERROR_CODES, GIST_CONFIG, VALID_SKILL_TYPES } from './constants';
import { SkillManagerError } from './errors';
import { sanitizeSkillName, validateFilename, validateGistUrl, validateGitUrl } from './validation';

/**
 * Load and validate configuration from file
 * @param configPath Path to configuration file
 * @returns Validated configuration with resolved paths
 */
export async function loadConfig(configPath: string = 'config.json'): Promise<Config> {
  const resolvedPath = path.resolve(configPath);

  if (!(await fs.pathExists(resolvedPath))) {
    throw new SkillManagerError(
      `Config file not found: ${resolvedPath}`,
      ERROR_CODES.CONFIG_NOT_FOUND,
      { configPath: resolvedPath }
    );
  }

  let configContent: string;
  try {
    configContent = await fs.readFile(resolvedPath, 'utf-8');
  } catch (error) {
    throw new SkillManagerError(
      `Failed to read config file: ${error instanceof Error ? error.message : String(error)}`,
      ERROR_CODES.CONFIG_NOT_FOUND,
      { configPath: resolvedPath },
      error instanceof Error ? error : undefined
    );
  }

  let config: any;
  try {
    config = JSON.parse(configContent);
  } catch (error) {
    throw new SkillManagerError(
      `Invalid JSON in config file: ${error instanceof Error ? error.message : String(error)}`,
      ERROR_CODES.INVALID_CONFIG,
      { configPath: resolvedPath },
      error instanceof Error ? error : undefined
    );
  }

  // Default skillsPath if not provided
  if (!config.skillsPath) {
    config.skillsPath = DEFAULT_SKILLS_PATH;
  }

  if (!config.skills || !Array.isArray(config.skills)) {
    throw new SkillManagerError('Config must include "skills" array', ERROR_CODES.INVALID_CONFIG, {
      configPath: resolvedPath,
      hasSkills: !!config.skills,
      isArray: Array.isArray(config.skills),
    });
  }

  if (config.skills.length === 0) {
    throw new SkillManagerError(
      'Config skills array must not be empty',
      ERROR_CODES.INVALID_CONFIG,
      { configPath: resolvedPath }
    );
  }

  // Resolve ~ in skillsPath
  config.skillsPath = resolveHomePath(config.skillsPath);

  // Validate each skill
  for (const skillEntry of config.skills) {
    const skillName = Object.keys(skillEntry)[0];
    const skillConfig = skillEntry[skillName];
    validateSkillConfig(skillName, skillConfig);
  }

  return config as Config;
}

/**
 * Resolve home directory path (~)
 * @param filepath Path that may contain ~
 * @returns Resolved absolute path
 */
export function resolveHomePath(filepath: string): string {
  if (filepath.startsWith('~/') || filepath === '~') {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

/**
 * Validate individual skill configuration
 * @param skillName Name of the skill
 * @param config Skill configuration to validate
 * @throws SkillManagerError if validation fails
 */
export function validateSkillConfig(skillName: string, config: Record<string, any>): void {
  // Validate skill name
  sanitizeSkillName(skillName);

  if (!config.type) {
    throw new SkillManagerError(
      `Skill "${skillName}" missing "type" field`,
      ERROR_CODES.INVALID_CONFIG,
      { skillName }
    );
  }

  if (!VALID_SKILL_TYPES.includes(config.type)) {
    throw new SkillManagerError(
      `Skill "${skillName}" has invalid type "${config.type}". Must be one of: ${VALID_SKILL_TYPES.join(', ')}`,
      ERROR_CODES.INVALID_CONFIG,
      { skillName, type: config.type, validTypes: VALID_SKILL_TYPES }
    );
  }

  if (!config.remote) {
    throw new SkillManagerError(
      `Skill "${skillName}" missing "remote" field`,
      ERROR_CODES.INVALID_CONFIG,
      { skillName }
    );
  }

  if (typeof config.remote !== 'string') {
    throw new SkillManagerError(
      `Skill "${skillName}" remote must be a string`,
      ERROR_CODES.INVALID_CONFIG,
      { skillName, remoteType: typeof config.remote }
    );
  }

  // Validate URL based on type
  try {
    if (config.type === 'GIST') {
      validateGistUrl(config.remote);

      // Validate filename if provided
      if (config.filename) {
        validateFilename(config.filename, Array.from(GIST_CONFIG.MARKDOWN_EXTENSIONS));
      }
    } else {
      validateGitUrl(config.remote, config.type);
    }
  } catch (error) {
    throw new SkillManagerError(
      `Skill "${skillName}" has invalid remote URL: ${error instanceof Error ? error.message : String(error)}`,
      ERROR_CODES.INVALID_CONFIG,
      { skillName, type: config.type },
      error instanceof Error ? error : undefined
    );
  }

  // Validate ref if provided
  if (config.ref && typeof config.ref !== 'string') {
    throw new SkillManagerError(
      `Skill "${skillName}" ref must be a string`,
      ERROR_CODES.INVALID_CONFIG,
      { skillName, refType: typeof config.ref }
    );
  }
}
