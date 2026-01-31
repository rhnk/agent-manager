import { execSync } from 'child_process';
import { SkillManagerError } from './errors';
import { ERROR_CODES } from './constants';

/**
 * Check if a command is available in the system
 */
function isCommandAvailable(command: string): boolean {
  try {
    // Use 'which' on Unix-like systems
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check all required dependencies
 */
export function checkDependencies(): void {
  const requiredCommands = ['git'];
  const missingDependencies: string[] = [];

  for (const cmd of requiredCommands) {
    if (!isCommandAvailable(cmd)) {
      missingDependencies.push(cmd);
    }
  }

  if (missingDependencies.length > 0) {
    throw new SkillManagerError(
      `Missing required dependencies: ${missingDependencies.join(', ')}. Please install them and try again.`,
      ERROR_CODES.DEPENDENCY_ERROR,
      { missingDependencies }
    );
  }
}
