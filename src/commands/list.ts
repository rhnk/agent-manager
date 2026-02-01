import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { loadConfig } from '../config';
import { ConfigPathResolver } from '../cli-utils';
import { AgentType, SkillConfig } from '../types';
import { getLinkedAgents, validateAgentType } from '../agent-manager';
import { loadMetadata } from '../metadata-manager';
import { SkillManagerError } from '../errors';
import { resolveHomePath } from '../utils';

interface ListCommandOptions {
  config?: string;
  global?: boolean;
  verbose?: boolean;
  agent?: string;
}

interface SkillInfo {
  name: string;
  type: string;
  remote: string;
  ref?: string;
  filename?: string;
  agents: AgentType[];
  lastSync?: string;
  configuredAgents?: AgentType[];
}

/**
 * List command handler
 * Lists all skills with optional filtering and verbose mode
 */
export async function listCommand(options?: ListCommandOptions): Promise<void> {
  try {
    // Get config path
    const configPath = ConfigPathResolver.resolve(options?.config);

    // Check if config exists
    if (!(await fs.pathExists(configPath))) {
      console.log(chalk.yellow('No configuration file found.'));
      console.log(chalk.gray(`\nExpected location: ${configPath}`));
      console.log(chalk.gray('\nTo add your first skill, run:'));
      console.log(chalk.cyan('  skill-manager add --name <name> --type <type> --remote <url>\n'));
      return;
    }

    // Load config
    const config = await loadConfig(configPath);

    if (config.skills.length === 0) {
      console.log(chalk.yellow('No skills found in configuration.'));
      return;
    }

    // Build skill info list
    const skillsPath = resolveHomePath('~/.agents/skills');
    const skillInfos: SkillInfo[] = [];

    for (const skillEntry of config.skills) {
      const skillName = Object.keys(skillEntry)[0];
      const skillConfig: SkillConfig = skillEntry[skillName];

      // Get linked agents (actual symlinks)
      const linkedAgents = await getLinkedAgents(skillName);

      // Get last sync time if available
      let lastSync: string | undefined;
      const skillDir = path.join(skillsPath, skillName);
      if (await fs.pathExists(skillDir)) {
        const metadata = await loadMetadata(skillDir);
        if (metadata) {
          lastSync = metadata.lastSync;
        }
      }

      skillInfos.push({
        name: skillName,
        type: skillConfig.type,
        remote: skillConfig.remote,
        ref: skillConfig.type !== 'GIST' ? skillConfig.ref : skillConfig.ref,
        filename: skillConfig.type === 'GIST' ? skillConfig.filename : undefined,
        agents: linkedAgents,
        lastSync,
        configuredAgents: skillConfig.agents,
      });
    }

    // Filter by agent if specified
    let filteredSkills = skillInfos;
    if (options?.agent) {
      const agentFilter = options.agent;

      // Validate agent type
      if (validateAgentType(agentFilter)) {
        filteredSkills = skillInfos.filter((skill) =>
          skill.agents.includes(agentFilter as AgentType)
        );

        if (filteredSkills.length === 0) {
          console.log(chalk.yellow(`No skills found for agent "${agentFilter}".`));
          return;
        }
      }
    }

    // Display skills
    console.log(chalk.bold(`\nInstalled Skills (${filteredSkills.length}):\n`));

    if (options?.verbose) {
      displayVerbose(filteredSkills);
    } else {
      displayBasic(filteredSkills);
    }

    console.log('');
  } catch (error) {
    if (error instanceof SkillManagerError) {
      console.error(chalk.red('\nError:'), error.getDetailedMessage());
    } else {
      console.error(chalk.red('\nError:'), error instanceof Error ? error.message : String(error));
    }

    process.exit(1);
  }
}

/**
 * Display skills in basic format (default)
 */
function displayBasic(skills: SkillInfo[]): void {
  // Calculate column widths
  const nameWidth = Math.max(15, ...skills.map((s) => s.name.length));
  const typeWidth = Math.max(10, ...skills.map((s) => s.type.length));

  // Header
  console.log(
    chalk.gray(padRight('NAME', nameWidth) + '  ' + padRight('TYPE', typeWidth) + '  ' + 'AGENTS')
  );
  console.log(chalk.gray('-'.repeat(nameWidth + typeWidth + 50)));

  // Rows
  for (const skill of skills) {
    const agentList = skill.agents.length > 0 ? skill.agents.join(', ') : chalk.gray('none');
    console.log(
      chalk.cyan(padRight(skill.name, nameWidth)) +
        '  ' +
        padRight(skill.type, typeWidth) +
        '  ' +
        agentList
    );
  }
}

/**
 * Display skills in verbose format
 */
function displayVerbose(skills: SkillInfo[]): void {
  for (let i = 0; i < skills.length; i++) {
    const skill = skills[i];

    console.log(chalk.bold.cyan(skill.name));
    console.log(chalk.gray(`  Type:        ${skill.type}`));
    console.log(chalk.gray(`  Remote:      ${skill.remote}`));

    if (skill.ref) {
      console.log(chalk.gray(`  Ref:         ${skill.ref}`));
    }

    if (skill.filename) {
      console.log(chalk.gray(`  Filename:    ${skill.filename}`));
    }

    const agentList = skill.agents.length > 0 ? skill.agents.join(', ') : chalk.yellow('none');
    console.log(chalk.gray(`  Agents:      ${agentList}`));

    if (skill.lastSync) {
      const syncDate = new Date(skill.lastSync);
      console.log(chalk.gray(`  Last Sync:   ${syncDate.toLocaleString()}`));
    }

    // Show if there's a mismatch between configured and actual agents
    if (skill.configuredAgents && skill.configuredAgents.length > 0) {
      const missing = skill.configuredAgents.filter((a) => !skill.agents.includes(a));
      if (missing.length > 0) {
        console.log(chalk.yellow(`  ⚠ Missing symlinks for: ${missing.join(', ')}`));
      }
    }

    if (i < skills.length - 1) {
      console.log('');
    }
  }
}

/**
 * Pad string to the right with spaces
 */
function padRight(str: string, width: number): string {
  return str + ' '.repeat(Math.max(0, width - str.length));
}
