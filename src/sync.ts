import ora from 'ora';
import chalk from 'chalk';
import { Config, FetchResult, SkillConfig } from './types';
import { validateSkillConfig } from './config';
import { FetcherFactory } from './fetcher-factory';
import { isSkillManagerError } from './errors';
import { sanitizeSkillName } from './validation';

/**
 * Sync all skills from configuration
 * Uses factory pattern for fetcher selection (Open/Closed Principle)
 * @param config Application configuration
 * @param dryRun If true, show what would be synced without making changes
 * @returns Array of fetch results
 */
export async function syncSkills(config: Config, dryRun: boolean = false): Promise<FetchResult[]> {
  const results: FetchResult[] = [];

  console.log(chalk.bold('\nSyncing skills...\n'));

  for (const skillEntry of config.skills) {
    const rawSkillName = Object.keys(skillEntry)[0];
    const skillConfig: SkillConfig = skillEntry[rawSkillName];

    // Sanitize skill name for security
    let skillName: string;
    try {
      skillName = sanitizeSkillName(rawSkillName);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Invalid skill name "${rawSkillName}": ${errorMessage}`));
      results.push({ skillName: rawSkillName, success: false, error: errorMessage });
      continue;
    }

    const spinner = ora(`Syncing ${chalk.cyan(skillName)}`).start();

    try {
      // Validate skill config
      validateSkillConfig(skillName, skillConfig);

      if (dryRun) {
        spinner.succeed(
          `${chalk.cyan(skillName)} - Would sync from ${skillConfig.remote} (${skillConfig.type})`
        );
        results.push({ skillName, success: true });
        continue;
      }

      // Get fetcher from factory (Open/Closed Principle - extensible without modification)
      const fetcher = FetcherFactory.getFetcher(skillConfig.type);

      // Fetch the skill
      await fetcher.fetch(skillName, skillConfig, config.skillsPath);

      spinner.succeed(`${chalk.cyan(skillName)} - ${chalk.green('Synced successfully')}`);
      results.push({ skillName, success: true });
    } catch (error) {
      const errorMessage = isSkillManagerError(error)
        ? error.getDetailedMessage()
        : error instanceof Error
          ? error.message
          : String(error);
      spinner.fail(`${chalk.cyan(skillName)} - ${chalk.red('Failed')}: ${errorMessage}`);
      results.push({ skillName, success: false, error: errorMessage });
    }
  }

  return results;
}

/**
 * Print summary of sync results
 * @param results Array of fetch results
 */
export function printSummary(results: FetchResult[]): void {
  console.log('\n' + chalk.bold('Summary:'));

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`${chalk.green('✓')} Successful: ${successful}`);
  if (failed > 0) {
    console.log(`${chalk.red('✗')} Failed: ${failed}`);
  }

  console.log('');
}
