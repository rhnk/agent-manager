import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { Config } from './types';
import { isSkillManagerError, SkillManagerError } from './errors';
import { ERROR_CODES } from './constants';

/**
 * Resolves config file path with precedence priority
 * 1. CLI option (highest priority)
 * 2. Environment variable
 * 3. Default path (lowest priority)
 */
export class ConfigPathResolver {
  static resolve(cliOption?: string): string {
    // 1. CLI option (highest priority)
    if (cliOption) {
      return cliOption;
    }

    // 2. Environment variable
    if (process.env.SKILL_MANAGER_CONFIG_PATH) {
      return process.env.SKILL_MANAGER_CONFIG_PATH;
    }

    // 3. Default path (lowest priority)
    return path.join(os.homedir(), '.agents', 'skill_manager_config.json');
  }
}

/**
 * Handles all console output formatting for CLI
 */
export class OutputFormatter {
  static printHeader(): void {
    console.log(chalk.bold('Skill Manager\n'));
  }

  static printConfigLoaded(configPath: string, isDefault: boolean): void {
    console.log(chalk.gray(`Config loaded from: ${configPath}`));
    if (isDefault) {
      console.log(
        chalk.gray(
          `Skills path: ${process.env.SKILL_MANAGER_SKILLS_PATH || '~/.agents/skills'} ${chalk.yellow('(default)')}`
        )
      );
    }
  }

  static printConfigInfo(config: Config, isDefault: boolean): void {
    console.log(chalk.gray(`Config loaded from: ${config.skillsPath}`));
    if (isDefault) {
      console.log(chalk.gray(`Skills path: ${config.skillsPath} ${chalk.yellow('(default)')}`));
    } else {
      console.log(chalk.gray(`Skills path: ${config.skillsPath}`));
    }
    console.log(chalk.gray(`Skills to sync: ${config.skills.length}\n`));
  }

  static printDryRunMode(): void {
    console.log(chalk.yellow('DRY RUN MODE - No changes will be made\n'));
  }

  static printConfigNotFound(configPath: string): void {
    console.error(chalk.red(`Error: Config file not found: ${configPath}\n`));
    console.log(chalk.yellow('Configuration file is required. You can provide it via:\n'));
    console.log(
      chalk.cyan('1. CLI flag:         ') + 'skill-manager sync --config /path/to/config.json'
    );
    console.log(
      chalk.cyan('2. Environment var:  ') + 'export SKILL_MANAGER_CONFIG_PATH=/path/to/config.json'
    );
    console.log(chalk.cyan('3. Default location: ') + '~/.agents/skill_manager_config.json\n');
  }

  static printError(error: Error | SkillManagerError): void {
    if (isSkillManagerError(error)) {
      console.error(chalk.red('\nError:'), error.getDetailedMessage());
    } else {
      console.error(chalk.red('\nError:'), error.message);
    }
  }
}

/**
 * Validates configuration file availability and accessibility
 */
export class ConfigValidator {
  static async validateExists(configPath: string): Promise<void> {
    if (!(await fs.pathExists(configPath))) {
      throw new SkillManagerError(
        `Config file not found: ${configPath}`,
        ERROR_CODES.CONFIG_NOT_FOUND,
        { configPath }
      );
    }
  }

  static async loadRawConfig(configPath: string): Promise<Record<string, unknown>> {
    try {
      const configContent = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(configContent);
    } catch (error) {
      throw new SkillManagerError(
        `Failed to read/parse config file: ${error instanceof Error ? error.message : String(error)}`,
        ERROR_CODES.INVALID_CONFIG,
        { configPath },
        error instanceof Error ? error : undefined
      );
    }
  }
}
