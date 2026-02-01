#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig } from './config';
import { printSummary, syncSkills } from './sync';
import { checkDependencies } from './dependency-check';
import { ConfigPathResolver, ConfigValidator, OutputFormatter } from './cli-utils';
import { addCommand } from './commands/add';
import { removeCommand } from './commands/remove';
import { listCommand } from './commands/list';

const program = new Command();

program
  .name('skill-manager')
  .description(
    'CLI tool to sync remote Git files, folders, repositories, and Gists to local skill folders'
  )
  .version('1.0.0');

program
  .command('sync')
  .description('Sync all skills from config file')
  .option('-c, --config <path>', 'Path to config file')
  .option('-d, --dry-run', 'Show what would be synced without making changes', false)
  .option(
    '-f, --force [skills...]',
    'Force re-sync specific skills (or all if no names provided), ignoring skip checks'
  )
  .action(async (options) => {
    try {
      // Print header
      OutputFormatter.printHeader();

      // Check dependencies early
      checkDependencies();

      // Determine config path with precedence
      const configPath = ConfigPathResolver.resolve(options.config);

      // Validate config file exists
      await ConfigValidator.validateExists(configPath);

      // Load raw config to check for default skills path
      const rawConfig = await ConfigValidator.loadRawConfig(configPath);
      const usingDefault = !rawConfig.skillsPath;

      // Load and validate configuration
      const config = await loadConfig(configPath);
      OutputFormatter.printConfigInfo(config, usingDefault);

      if (options.dryRun) {
        OutputFormatter.printDryRunMode();
      }

      // Parse force option
      // If --force is used without arguments, force is true (force all)
      // If --force skill1 skill2, force is an array of skill names
      let forceSkills: string[] | undefined;
      if (options.force) {
        if (Array.isArray(options.force)) {
          forceSkills = options.force;
        } else if (options.force === true) {
          // --force without arguments: force all skills
          forceSkills = config.skills.map((s) => Object.keys(s)[0]);
        }
      }

      // Sync skills
      const results = await syncSkills(config, options.dryRun, forceSkills);

      // Print summary
      printSummary(results);

      // Exit with error code if any skill failed
      const hasFailures = results.some((r) => !r.success);
      if (hasFailures) {
        process.exit(1);
      }
    } catch (error) {
      OutputFormatter.printError(error instanceof Error ? error : new Error(String(error)));
      process.exit(1);
    }
  });

program
  .command('set')
  .alias('add')
  .description('Add a new skill or update an existing one')
  .requiredOption('--name <name>', 'Name of the skill')
  .requiredOption('--type <type>', 'Type of skill (GIT_FILE, GIT_FOLDER, GIT_REPO, GIST)')
  .requiredOption('--remote <url>', 'Remote URL of the skill')
  .option('--ref <ref>', 'Git reference (branch, tag, or commit SHA)')
  .option('--filename <filename>', 'Specific file to fetch (for GIST type)')
  .option(
    '--agent <agents...>',
    'Agent(s) to link to (antigravity, claude-code, codex, cursor, gemini-cli, github-copilot)'
  )
  .option('-c, --config <path>', 'Path to config file')
  .action(async (options) => {
    await addCommand({
      name: options.name,
      type: options.type,
      remote: options.remote,
      ref: options.ref,
      filename: options.filename,
      agent: options.agent,
      config: options.config,
    });
  });

program
  .command('remove [skillName]')
  .alias('rm')
  .description('Remove a skill from the configuration')
  .option('-c, --config <path>', 'Path to config file')
  .option('-g, --global', 'Remove global skill (same as default)')
  .action(removeCommand);

program
  .command('list')
  .alias('ls')
  .description('List all installed skills')
  .option('-c, --config <path>', 'Path to config file')
  .option('-g, --global', 'List global skills (same as default)')
  .option('-v, --verbose', 'Show detailed information')
  .option('-a, --agent <agent>', 'Filter by agent type')
  .action(listCommand);

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

program.parse();
