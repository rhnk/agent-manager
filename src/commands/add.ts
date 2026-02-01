import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs-extra';
import { AgentType, SkillConfig, SkillType } from '../types';
import {
  sanitizeSkillName,
  validateFilename,
  validateGistUrl,
  validateGitUrl,
} from '../validation';
import { addSkillToConfig } from '../config';
import { ConfigPathResolver } from '../cli-utils';
import { FetcherFactory } from '../fetcher-factory';
import { ensureSkillDirectory } from '../file-manager';
import { createSymlinksForSkill, getAllAgentTypes, validateAgentType } from '../agent-manager';
import { SkillManagerError } from '../errors';
import { DEFAULT_SKILLS_PATH, ERROR_CODES, GIST_CONFIG, VALID_SKILL_TYPES } from '../constants';
import { resolveHomePath } from '../utils';

interface AddCommandOptions {
  name: string;
  type: string;
  remote: string;
  ref?: string;
  filename?: string;
  agent?: string[];
  config?: string;
}

/**
 * Rollback state to track what has been created
 */
interface RollbackState {
  configCreated: boolean;
  configPath: string;
  skillDirCreated: boolean;
  skillDir: string;
  symlinkCreated: boolean;
  configUpdated: boolean;
}

/**
 * Rollback any changes made during add command if it fails
 */
async function rollback(state: RollbackState): Promise<void> {
  console.log(chalk.yellow('\nRolling back changes...'));

  try {
    // Remove skill directory if we created it
    if (state.skillDirCreated && (await fs.pathExists(state.skillDir))) {
      await fs.remove(state.skillDir);
      console.log(chalk.gray(`  Removed skill directory: ${state.skillDir}`));
    }

    // Remove config file if we created it (first-time user scenario)
    if (state.configCreated && (await fs.pathExists(state.configPath))) {
      await fs.remove(state.configPath);
      console.log(chalk.gray(`  Removed config file: ${state.configPath}`));
    }

    console.log(chalk.yellow('Rollback complete.\n'));
  } catch (rollbackError) {
    console.error(
      chalk.red('Warning: Some rollback operations failed:'),
      rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
    );
  }
}

/**
 * Add command handler
 * Adds a new skill to the configuration and creates symlinks
 * Includes rollback on failure
 */
export async function addCommand(options: AddCommandOptions): Promise<void> {
  const spinner = ora('Adding skill...').start();

  const rollbackState: RollbackState = {
    configCreated: false,
    configPath: '',
    skillDirCreated: false,
    skillDir: '',
    symlinkCreated: false,
    configUpdated: false,
  };

  let skillName: string = '';

  try {
    // 1. Validate and sanitize inputs
    skillName = sanitizeSkillName(options.name);

    // Validate skill type
    if (!VALID_SKILL_TYPES.includes(options.type as SkillType)) {
      throw new SkillManagerError(
        `Invalid skill type: ${options.type}. Must be one of: ${VALID_SKILL_TYPES.join(', ')}`,
        ERROR_CODES.VALIDATION_ERROR,
        { type: options.type }
      );
    }
    const skillType = options.type as SkillType;

    // Validate remote URL
    if (skillType === 'GIST') {
      validateGistUrl(options.remote);

      // Validate filename if provided for GIST
      if (options.filename) {
        validateFilename(options.filename, Array.from(GIST_CONFIG.MARKDOWN_EXTENSIONS));
      }
    } else {
      validateGitUrl(options.remote, skillType);
    }

    // Validate and parse agents
    let agents: AgentType[] | undefined;
    if (options.agent && options.agent.length > 0) {
      agents = [];
      for (const agent of options.agent) {
        if (validateAgentType(agent)) {
          agents.push(agent as AgentType);
        }
      }
    }

    // 2. Build skill config
    const skillConfig: SkillConfig = {
      type: skillType,
      remote: options.remote,
    } as SkillConfig;

    if (options.ref) {
      // TypeScript discriminated union workaround
      if (skillConfig.type === 'GIST') {
        skillConfig.ref = options.ref;
      } else {
        skillConfig.ref = options.ref;
      }
    }

    if (options.filename && skillType === 'GIST') {
      if (skillConfig.type === 'GIST') {
        skillConfig.filename = options.filename;
      }
    }

    if (agents && agents.length > 0) {
      skillConfig.agents = agents;
    }

    // 3. Get config path and create if doesn't exist
    const configPath = ConfigPathResolver.resolve(options.config);
    rollbackState.configPath = configPath;
    let isNewConfig = false;

    // Create config file if it doesn't exist (first-time user)
    if (!(await fs.pathExists(configPath))) {
      isNewConfig = true;
      spinner.text = 'Creating config file...';

      // Ensure parent directory exists
      const configDir = path.dirname(configPath);
      await fs.ensureDir(configDir);

      // Create initial config with the skill being added
      const initialConfig = {
        skillsPath: DEFAULT_SKILLS_PATH,
        skills: [{ [skillName]: skillConfig }],
      };

      await fs.writeJson(configPath, initialConfig, { spaces: 2 });
      rollbackState.configCreated = true;

      console.log(chalk.green(`✓ Created config file at: ${configPath}\n`));
      spinner.text = `Downloading skill "${skillName}"...`;
    } else {
      spinner.text = `Downloading skill "${skillName}"...`;
    }

    // 4. Download skill to ~/.agents/skills/[skill-name]
    const skillsPath = resolveHomePath('~/.agents/skills');
    const skillDir = await ensureSkillDirectory(skillsPath, skillName);
    rollbackState.skillDir = skillDir;
    rollbackState.skillDirCreated = true;

    // Use fetcher to download the skill
    const fetcher = FetcherFactory.getFetcher(skillType);
    await fetcher.fetch(skillName, skillConfig, skillsPath);

    spinner.text = `Creating symlinks for "${skillName}"...`;

    // 5. Create symlinks in agent directories
    await createSymlinksForSkill(skillName, skillDir, agents);
    rollbackState.symlinkCreated = true;

    spinner.text = `Updating configuration...`;

    // 6. Add to config file (skip if we just created it with the skill)
    if (!isNewConfig) {
      await addSkillToConfig(configPath, skillName, skillConfig);
      rollbackState.configUpdated = true;
    }

    spinner.succeed(chalk.green(`✓ Successfully added skill "${skillName}"`));

    // Display summary
    console.log(chalk.gray('\nSkill details:'));
    console.log(chalk.gray(`  Name: ${skillName}`));
    console.log(chalk.gray(`  Type: ${skillType}`));
    console.log(chalk.gray(`  Remote: ${options.remote}`));
    if (options.ref) {
      console.log(chalk.gray(`  Ref: ${options.ref}`));
    }
    if (options.filename) {
      console.log(chalk.gray(`  Filename: ${options.filename}`));
    }

    const targetAgents = agents && agents.length > 0 ? agents : getAllAgentTypes();
    console.log(chalk.gray(`  Linked to agents: ${targetAgents.join(', ')}`));
    console.log('');
  } catch (error) {
    spinner.fail(chalk.red('Failed to add skill'));

    // Attempt rollback
    await rollback(rollbackState);

    if (error instanceof SkillManagerError) {
      console.error(chalk.red('\nError:'), error.getDetailedMessage());
    } else {
      console.error(chalk.red('\nError:'), error instanceof Error ? error.message : String(error));
    }

    process.exit(1);
  }
}
