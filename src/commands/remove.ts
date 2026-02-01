import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs-extra';
import readline from 'readline';
import { getSkillNamesFromConfig, removeSkillFromConfig } from '../config';
import { ConfigPathResolver } from '../cli-utils';
import { removeSymlinksForSkill } from '../agent-manager';
import { SkillManagerError } from '../errors';
import { resolveHomePath } from '../utils';

interface RemoveCommandOptions {
  config?: string;
  global?: boolean;
}

/**
 * Remove command handler
 * Removes a skill from the configuration and deletes symlinks
 */
export async function removeCommand(
  skillName?: string,
  options?: RemoveCommandOptions
): Promise<void> {
  try {
    // Get config path
    const configPath = ConfigPathResolver.resolve(options?.config);

    // Check if config exists
    if (!(await fs.pathExists(configPath))) {
      console.log(chalk.yellow('No configuration file found.'));
      console.log(chalk.gray(`\nExpected location: ${configPath}`));
      console.log(chalk.gray('No skills to remove.\n'));
      return;
    }

    // If no skill name provided, show interactive list
    if (!skillName) {
      skillName = await promptForSkillSelection(configPath);
      if (!skillName) {
        console.log(chalk.yellow('No skill selected. Aborting.'));
        return;
      }
    }

    const spinner = ora(`Removing skill "${skillName}"...`).start();

    try {
      // 1. Remove skill directory from ~/.agents/skills/
      const skillsPath = resolveHomePath('~/.agents/skills');
      const skillDir = path.join(skillsPath, skillName);

      if (await fs.pathExists(skillDir)) {
        spinner.text = `Removing skill directory...`;
        await fs.remove(skillDir);
      }

      // 2. Remove symlinks from all agent directories
      spinner.text = `Removing symlinks...`;
      await removeSymlinksForSkill(skillName);

      // 3. Remove from config
      spinner.text = `Updating configuration...`;
      await removeSkillFromConfig(configPath, skillName);

      spinner.succeed(chalk.green(`✓ Successfully removed skill "${skillName}"`));
    } catch (error) {
      spinner.fail(chalk.red(`Failed to remove skill "${skillName}"`));
      throw error;
    }
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
 * Prompt user to select a skill for removal (interactive mode)
 * @param configPath Path to config file
 * @returns Selected skill name or undefined
 */
async function promptForSkillSelection(configPath: string): Promise<string | undefined> {
  try {
    const skillNames = await getSkillNamesFromConfig(configPath);

    if (skillNames.length === 0) {
      console.log(chalk.yellow('No skills found in configuration.'));
      return undefined;
    }

    console.log(chalk.bold('\nSelect a skill to remove:\n'));
    skillNames.forEach((name, index) => {
      console.log(`  ${chalk.cyan(index + 1)}. ${name}`);
    });
    console.log(`  ${chalk.cyan('0')}. Cancel\n`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise<string | undefined>((resolve) => {
      rl.question('Enter selection: ', (answer) => {
        rl.close();

        const trimmed = answer.trim();

        // Check for empty input
        if (trimmed === '') {
          console.log(chalk.red('No selection entered.'));
          resolve(undefined);
          return;
        }

        const selection = parseInt(trimmed, 10);

        // Check for non-numeric or out of range
        if (isNaN(selection)) {
          console.log(chalk.red('Invalid selection. Please enter a number.'));
          resolve(undefined);
          return;
        }

        if (selection < 0 || selection > skillNames.length) {
          console.log(
            chalk.red(
              `Invalid selection. Please enter a number between 0 and ${skillNames.length}.`
            )
          );
          resolve(undefined);
          return;
        }

        if (selection === 0) {
          resolve(undefined);
          return;
        }

        resolve(skillNames[selection - 1]);
      });
    });
  } catch (error) {
    console.error(chalk.red('Failed to load skills from config:'), error);
    return undefined;
  }
}
