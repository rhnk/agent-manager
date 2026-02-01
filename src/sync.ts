import ora from 'ora';
import chalk from 'chalk';
import path from 'path';
import { Config, FetchResult, SkillConfig } from './types';
import { validateSkillConfig } from './config';
import { FetcherFactory } from './fetcher-factory';
import { isSkillManagerError } from './errors';
import { sanitizeSkillName } from './validation';
import { shouldSkipSync } from './skip-checker';
import { promptForOverwrite } from './interaction';
import { createSymlinksForSkill } from './agent-manager';
import { pLimit } from './utils';

/**
 * Maximum concurrent skill syncs to prevent overwhelming the system
 */
const MAX_CONCURRENT_SYNCS = 5;

/**
 * Sync a single skill
 * Extracted function for parallel processing
 */
async function syncSingleSkill(
  skillEntry: { [skillName: string]: SkillConfig },
  config: Config,
  dryRun: boolean,
  forceSkills?: string[]
): Promise<FetchResult> {
  const rawSkillName = Object.keys(skillEntry)[0];
  const skillConfig: SkillConfig = skillEntry[rawSkillName];

  // Sanitize skill name for security
  let skillName: string;
  try {
    skillName = sanitizeSkillName(rawSkillName);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Invalid skill name "${rawSkillName}": ${errorMessage}`));
    return { skillName: rawSkillName, success: false, error: errorMessage };
  }

  const spinner = ora(`Syncing ${chalk.cyan(skillName)}`).start();

  try {
    // Validate skill config
    validateSkillConfig(skillName, skillConfig);

    if (dryRun) {
      spinner.succeed(
        `${chalk.cyan(skillName)} - Would sync from ${skillConfig.remote} (${skillConfig.type})`
      );
      return { skillName, success: true };
    }

    // Check if we should force this skill
    const shouldForce = forceSkills && forceSkills.length > 0 && forceSkills.includes(skillName);

    // Check if sync can be skipped (unless forced)
    if (!shouldForce) {
      const skipCheck = await shouldSkipSync(skillName, skillConfig, config.skillsPath);

      if (skipCheck.shouldSkip) {
        spinner.info(`${chalk.cyan(skillName)} - ${chalk.yellow('Skipped')}: ${skipCheck.reason}`);
        return { skillName, success: true, skipped: true, reason: skipCheck.reason };
      }

      // Handle local modifications
      if (skipCheck.needsInteraction) {
        spinner.stop();
        const shouldOverwrite = await promptForOverwrite(skillName);
        if (!shouldOverwrite) {
          spinner.info(
            `${chalk.cyan(skillName)} - ${chalk.yellow('Skipped')}: ${skipCheck.reason}`
          );
          return { skillName, success: true, skipped: true, reason: skipCheck.reason };
        }
        spinner.start(`Syncing ${chalk.cyan(skillName)}`);
      }
    }

    // Get fetcher from factory (Open/Closed Principle - extensible without modification)
    const fetcher = FetcherFactory.getFetcher(skillConfig.type);

    // Fetch the skill
    await fetcher.fetch(skillName, skillConfig, config.skillsPath);

    // Create symlinks for the skill to agent directories
    const skillSourcePath = path.join(config.skillsPath, skillName);
    try {
      await createSymlinksForSkill(skillName, skillSourcePath, skillConfig.agents);
    } catch (symlinkError) {
      // Log symlink error but don't fail the whole sync
      console.warn(
        chalk.yellow(`Warning: Failed to create some symlinks for ${skillName}: ${symlinkError}`)
      );
    }

    spinner.succeed(`${chalk.cyan(skillName)} - ${chalk.green('Synced successfully')}`);
    return { skillName, success: true };
  } catch (error) {
    const errorMessage = isSkillManagerError(error)
      ? error.getDetailedMessage()
      : error instanceof Error
        ? error.message
        : String(error);
    spinner.fail(`${chalk.cyan(skillName)} - ${chalk.red('Failed')}: ${errorMessage}`);
    return { skillName, success: false, error: errorMessage };
  }
}

/**
 * Sync all skills from configuration
 * Uses parallel processing with concurrency limit for better performance
 * Uses factory pattern for fetcher selection (Open/Closed Principle)
 * @param config Application configuration
 * @param dryRun If true, show what would be synced without making changes
 * @param forceSkills Optional array of skill names to force sync (overrides skip check)
 * @returns Array of fetch results
 */
export async function syncSkills(
  config: Config,
  dryRun: boolean = false,
  forceSkills?: string[]
): Promise<FetchResult[]> {
  console.log(chalk.bold('\nSyncing skills...\n'));

  // Sync skills with concurrency limit for better performance
  const results = await pLimit(
    config.skills,
    (skillEntry) => syncSingleSkill(skillEntry, config, dryRun, forceSkills),
    MAX_CONCURRENT_SYNCS
  );

  return results;
}

/**
 * Print summary of sync results
 * @param results Array of fetch results
 */
export function printSummary(results: FetchResult[]): void {
  console.log('\n' + chalk.bold('Summary:'));

  const successful = results.filter((r) => r.success && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`${chalk.green('✓')} Successful: ${successful}`);
  if (skipped > 0) {
    console.log(`${chalk.yellow('⊘')} Skipped: ${skipped}`);
  }
  if (failed > 0) {
    console.log(`${chalk.red('✗')} Failed: ${failed}`);
  }

  console.log('');
}
