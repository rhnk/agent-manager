import fs from 'fs-extra';
import path from 'path';
import { AgentType } from './types';
import { SkillManagerError, wrapError } from './errors';
import { ERROR_CODES } from './constants';
import { resolveHomePath, validatePathWithinBase } from './utils';

/**
 * Agent path configuration
 * Maps agent types to their global skill directories
 */
export const AGENT_PATHS: Record<AgentType, { global: string }> = {
  antigravity: { global: '~/.gemini/antigravity/global_skills/' },
  'claude-code': { global: '~/.claude/skills/' },
  codex: { global: '~/.codex/skills/' },
  cursor: { global: '~/.cursor/skills/' },
  'gemini-cli': { global: '~/.gemini/skills/' },
  'github-copilot': { global: '~/.copilot/skills/' },
};

/**
 * Get all valid agent types
 */
export function getAllAgentTypes(): AgentType[] {
  return Object.keys(AGENT_PATHS) as AgentType[];
}

/**
 * Validate agent type
 * @param agent Agent type to validate
 * @throws SkillManagerError if invalid
 */
export function validateAgentType(agent: string): agent is AgentType {
  const validAgents = getAllAgentTypes();
  if (!validAgents.includes(agent as AgentType)) {
    throw new SkillManagerError(
      `Invalid agent type: ${agent}. Must be one of: ${validAgents.join(', ')}`,
      ERROR_CODES.VALIDATION_ERROR,
      { agent, validAgents }
    );
  }
  return true;
}

/**
 * Get global path for a specific agent
 * @param agent Agent type
 * @returns Resolved global path
 */
export function getAgentGlobalPath(agent: AgentType): string {
  const agentPath = AGENT_PATHS[agent].global;
  return resolveHomePath(agentPath);
}

/**
 * Get all global paths for specified agents (or all if none specified)
 * @param agents Optional array of specific agents
 * @returns Array of resolved global paths
 */
export function getAllAgentGlobalPaths(agents?: AgentType[]): string[] {
  const targetAgents = agents && agents.length > 0 ? agents : getAllAgentTypes();
  return targetAgents.map((agent) => getAgentGlobalPath(agent));
}

/**
 * Create a symlink from source to target
 * @param source Source directory/file (actual skill location)
 * @param target Target path (where symlink will be created)
 * @param skillName Name of the skill (for error messages)
 */
export async function createSymlink(
  source: string,
  target: string,
  skillName: string
): Promise<void> {
  try {
    // Ensure source exists
    if (!(await fs.pathExists(source))) {
      throw new Error(`Source path does not exist: ${source}`);
    }

    // Validate target is within expected agent directories
    const targetDir = path.dirname(target);
    const allAgentPaths = getAllAgentGlobalPaths();
    const isValidTarget = allAgentPaths.some((agentPath) => {
      try {
        validatePathWithinBase(agentPath, target);
        return true;
      } catch {
        return false;
      }
    });

    if (!isValidTarget) {
      throw new SkillManagerError(
        'Target path is not within any valid agent directory',
        ERROR_CODES.VALIDATION_ERROR,
        { target, allowedPaths: allAgentPaths }
      );
    }

    // Ensure target directory exists
    await fs.ensureDir(targetDir);

    // Remove existing symlink or directory at target
    if (await fs.pathExists(target)) {
      const stats = await fs.lstat(target);
      if (stats.isSymbolicLink()) {
        await fs.unlink(target);
      } else {
        // If it's a regular directory/file, we should not overwrite
        console.warn(
          `Warning: ${target} already exists and is not a symlink. Skipping symlink creation.`
        );
        return;
      }
    }

    // Create symlink (type 'dir' for directories, 'file' for files)
    const sourceStats = await fs.stat(source);
    const symlinkType = sourceStats.isDirectory() ? 'dir' : 'file';
    await fs.symlink(source, target, symlinkType);
  } catch (error) {
    throw wrapError(
      error,
      `Failed to create symlink for skill "${skillName}" from ${source} to ${target}`,
      ERROR_CODES.FILE_SYSTEM_ERROR,
      { source, target, skillName }
    );
  }
}

/**
 * Create symlinks for a skill to all specified agent directories
 * Creates symlinks in parallel for better performance
 * @param skillName Name of the skill
 * @param skillSourcePath Full path to the skill source (e.g., ~/.agents/skills/my-skill)
 * @param agents Optional array of specific agents (all if not specified)
 */
export async function createSymlinksForSkill(
  skillName: string,
  skillSourcePath: string,
  agents?: AgentType[]
): Promise<void> {
  const targetAgents = agents && agents.length > 0 ? agents : getAllAgentTypes();

  // Create symlinks in parallel
  await Promise.all(
    targetAgents.map(async (agent) => {
      const agentPath = getAgentGlobalPath(agent);
      const symlinkPath = path.join(agentPath, skillName);

      try {
        await createSymlink(skillSourcePath, symlinkPath, skillName);
      } catch (error) {
        // Log error but continue with other agents
        console.error(`Failed to create symlink for agent ${agent}:`, error);
      }
    })
  );
}

/**
 * Remove symlink at target path
 * @param target Path to symlink to remove
 */
async function removeSymlink(target: string): Promise<void> {
  try {
    if (await fs.pathExists(target)) {
      const stats = await fs.lstat(target);
      if (stats.isSymbolicLink()) {
        await fs.unlink(target);
      }
    }
  } catch (error) {
    console.warn(`Warning: Failed to remove symlink at ${target}:`, error);
  }
}

/**
 * Remove symlinks for a skill from specified agent directories
 * @param skillName Name of the skill
 * @param agents Optional array of specific agents (all if not specified)
 */
export async function removeSymlinksForSkill(
  skillName: string,
  agents?: AgentType[]
): Promise<void> {
  const targetAgents = agents && agents.length > 0 ? agents : getAllAgentTypes();

  for (const agent of targetAgents) {
    const agentPath = getAgentGlobalPath(agent);
    const symlinkPath = path.join(agentPath, skillName);
    await removeSymlink(symlinkPath);
  }
}

/**
 * Check if a path is a symlink
 * @param targetPath Path to check
 * @returns True if path exists and is a symlink
 */
export async function isSymlink(targetPath: string): Promise<boolean> {
  try {
    if (await fs.pathExists(targetPath)) {
      const stats = await fs.lstat(targetPath);
      return stats.isSymbolicLink();
    }
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Get list of agents that a skill is currently linked to
 * @param skillName Name of the skill
 * @returns Array of agent types that have symlinks to this skill
 */
export async function getLinkedAgents(skillName: string): Promise<AgentType[]> {
  const linkedAgents: AgentType[] = [];
  const allAgents = getAllAgentTypes();

  for (const agent of allAgents) {
    const agentPath = getAgentGlobalPath(agent);
    const symlinkPath = path.join(agentPath, skillName);

    if (await isSymlink(symlinkPath)) {
      linkedAgents.push(agent);
    }
  }

  return linkedAgents;
}
