import fs from 'fs-extra';
import path from 'path';
import { Config, SkillConfig } from './types';
import { DEFAULT_SKILLS_PATH, ERROR_CODES, GIST_CONFIG, VALID_SKILL_TYPES } from './constants';
import { SkillManagerError } from './errors';
import { sanitizeSkillName, validateFilename, validateGistUrl, validateGitUrl } from './validation';
import { resolveHomePath } from './utils';
import { ConfigSchema } from './schemas';

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

    // Validate size to prevent DoS
    const maxConfigSize = 10 * 1024 * 1024; // 10MB
    if (configContent.length > maxConfigSize) {
      throw new SkillManagerError('Config file too large (max 10MB)', ERROR_CODES.INVALID_CONFIG, {
        configPath: resolvedPath,
        size: configContent.length,
      });
    }
  } catch (error) {
    throw new SkillManagerError(
      `Failed to read config file: ${error instanceof Error ? error.message : String(error)}`,
      ERROR_CODES.CONFIG_NOT_FOUND,
      { configPath: resolvedPath },
      error instanceof Error ? error : undefined
    );
  }

  let rawConfig: unknown;
  try {
    rawConfig = JSON.parse(configContent);
  } catch (error) {
    throw new SkillManagerError(
      `Invalid JSON in config file: ${error instanceof Error ? error.message : String(error)}`,
      ERROR_CODES.INVALID_CONFIG,
      { configPath: resolvedPath },
      error instanceof Error ? error : undefined
    );
  }

  // Validate with Zod schema
  const parseResult = ConfigSchema.safeParse(rawConfig);
  if (!parseResult.success) {
    const errorMessages = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    throw new SkillManagerError(
      `Invalid config structure: ${errorMessages.join(', ')}`,
      ERROR_CODES.INVALID_CONFIG,
      { configPath: resolvedPath, errors: errorMessages }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = parseResult.data as any;

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

/**
 * Add or update a skill in the config file
 * If the skill already exists, it will be updated. Otherwise, it will be added.
 * @param configPath Path to config file
 * @param skillName Name of the skill
 * @param skillConfig Skill configuration
 * @throws SkillManagerError if operation fails
 */
export async function addSkillToConfig(
  configPath: string,
  skillName: string,
  skillConfig: SkillConfig
): Promise<void> {
  try {
    const resolvedPath = path.resolve(configPath);

    // Check if config file exists
    if (!(await fs.pathExists(resolvedPath))) {
      throw new SkillManagerError(
        `Config file not found: ${resolvedPath}`,
        ERROR_CODES.CONFIG_NOT_FOUND,
        { configPath: resolvedPath }
      );
    }

    // Read raw config without validation to support empty skills arrays
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let config: any;
    try {
      const configContent = await fs.readFile(resolvedPath, 'utf-8');
      config = JSON.parse(configContent);
    } catch (error) {
      throw new SkillManagerError(
        `Failed to read config file: ${error instanceof Error ? error.message : String(error)}`,
        ERROR_CODES.INVALID_CONFIG,
        { configPath: resolvedPath },
        error instanceof Error ? error : undefined
      );
    }

    // Ensure skills array exists
    if (!config.skills || !Array.isArray(config.skills)) {
      config.skills = [];
    }

    // Check if skill already exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingSkillIndex = config.skills.findIndex((s: any) => Object.keys(s)[0] === skillName);
    if (existingSkillIndex >= 0) {
      // Update existing skill
      config.skills[existingSkillIndex] = { [skillName]: skillConfig };
    } else {
      // Add new skill
      config.skills.push({ [skillName]: skillConfig });
    }

    // Write back to file
    await fs.writeFile(resolvedPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    if (error instanceof SkillManagerError) {
      throw error;
    }
    throw new SkillManagerError(
      `Failed to add skill to config: ${error instanceof Error ? error.message : String(error)}`,
      ERROR_CODES.FILE_SYSTEM_ERROR,
      { configPath, skillName },
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Remove a skill from the config file
 * @param configPath Path to config file
 * @param skillName Name of the skill to remove
 * @throws SkillManagerError if operation fails
 */
export async function removeSkillFromConfig(configPath: string, skillName: string): Promise<void> {
  try {
    // Load current config
    const config = await loadConfig(configPath);

    // Find and remove skill
    const initialLength = config.skills.length;
    config.skills = config.skills.filter((s) => Object.keys(s)[0] !== skillName);

    if (config.skills.length === initialLength) {
      throw new SkillManagerError(
        `Skill "${skillName}" not found in config`,
        ERROR_CODES.INVALID_CONFIG,
        { skillName, configPath }
      );
    }

    // Write back to file
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    if (error instanceof SkillManagerError) {
      throw error;
    }
    throw new SkillManagerError(
      `Failed to remove skill from config: ${error instanceof Error ? error.message : String(error)}`,
      ERROR_CODES.FILE_SYSTEM_ERROR,
      { configPath, skillName },
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Update a skill in the config file
 * @param configPath Path to config file
 * @param skillName Name of the skill to update
 * @param skillConfig Updated skill configuration
 * @throws SkillManagerError if operation fails
 */
export async function updateSkillInConfig(
  configPath: string,
  skillName: string,
  skillConfig: SkillConfig
): Promise<void> {
  try {
    // Load current config
    const config = await loadConfig(configPath);

    // Find and update skill
    const skillIndex = config.skills.findIndex((s) => Object.keys(s)[0] === skillName);
    if (skillIndex === -1) {
      throw new SkillManagerError(
        `Skill "${skillName}" not found in config`,
        ERROR_CODES.INVALID_CONFIG,
        { skillName, configPath }
      );
    }

    config.skills[skillIndex] = { [skillName]: skillConfig };

    // Write back to file
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    if (error instanceof SkillManagerError) {
      throw error;
    }
    throw new SkillManagerError(
      `Failed to update skill in config: ${error instanceof Error ? error.message : String(error)}`,
      ERROR_CODES.FILE_SYSTEM_ERROR,
      { configPath, skillName },
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get all skill names from config file
 * @param configPath Path to config file
 * @returns Array of skill names
 */
export async function getSkillNamesFromConfig(configPath: string): Promise<string[]> {
  const config = await loadConfig(configPath);
  return config.skills.map((s) => Object.keys(s)[0]);
}
