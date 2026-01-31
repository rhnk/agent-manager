import fs from 'fs-extra';
import path from 'path';

/**
 * Ensure a skill directory exists, creating it if necessary
 * @param skillsPath Base path for skills
 * @param skillName Name of the skill
 * @returns Path to the skill directory
 * @throws Error if directory creation fails
 */
export async function ensureSkillDirectory(skillsPath: string, skillName: string): Promise<string> {
  const skillDir = path.join(skillsPath, skillName);
  await fs.ensureDir(skillDir);
  return skillDir;
}

/**
 * Write a skill file to disk
 * @param skillDir Directory where the skill resides
 * @param filename Name of the file to write
 * @param content File content to write
 * @throws Error if write operation fails
 */
export async function writeSkillFile(
  skillDir: string,
  filename: string,
  content: string
): Promise<void> {
  const filepath = path.join(skillDir, filename);
  await fs.writeFile(filepath, content, 'utf-8');
}

/**
 * Clear all contents from a directory
 * @param directory Directory to clear
 * @throws Error if clear operation fails
 */
export async function clearDirectory(directory: string): Promise<void> {
  if (await fs.pathExists(directory)) {
    await fs.emptyDir(directory);
  }
}

/**
 * Copy directory contents from source to destination
 * @param source Source directory path
 * @param destination Destination directory path
 * @throws Error if copy operation fails
 */
export async function copyDirectory(source: string, destination: string): Promise<void> {
  await fs.copy(source, destination, { overwrite: true });
}

/**
 * Remove a directory and all its contents
 * @param directory Directory to remove
 * @throws Error if removal fails
 */
export async function removeDirectory(directory: string): Promise<void> {
  if (await fs.pathExists(directory)) {
    await fs.remove(directory);
  }
}
