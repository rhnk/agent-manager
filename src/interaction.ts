import readline from 'readline';

/**
 * Prompt user for confirmation when local modifications are detected
 * Only works in interactive terminals (TTY)
 *
 * @param skillName Name of the skill with local modifications
 * @returns Promise<boolean> True if user wants to overwrite, false to skip
 */
export async function promptForOverwrite(skillName: string): Promise<boolean> {
  // Check if we're in an interactive terminal
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    // Non-interactive mode (CI/CD) - default to not overwriting
    console.warn(
      `Skipping ${skillName}: Local modifications detected. Use --force to overwrite in non-interactive mode.`
    );
    return false;
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      `\nLocal modifications detected in "${skillName}". Overwrite? (y/N): `,
      (answer) => {
        rl.close();
        const response = answer.trim().toLowerCase();
        resolve(response === 'y' || response === 'yes');
      }
    );
  });
}

/**
 * Check if we're running in an interactive terminal
 * @returns True if terminal is interactive
 */
export function isInteractive(): boolean {
  return !!(process.stdout.isTTY && process.stdin.isTTY);
}
