import path from 'path';
import os from 'os';
import { SkillManagerError } from './errors';
import { ERROR_CODES } from './constants';

/**
 * Resolve home directory path (~) and validate the result
 * @param filepath Path that may contain ~
 * @returns Resolved absolute path
 * @throws SkillManagerError if path is invalid
 */
export function resolveHomePath(filepath: string): string {
  if (!filepath || typeof filepath !== 'string') {
    throw new SkillManagerError(
      'File path must be a non-empty string',
      ERROR_CODES.VALIDATION_ERROR,
      { filepath }
    );
  }

  let resolved: string;
  if (filepath.startsWith('~/') || filepath === '~') {
    resolved = path.join(os.homedir(), filepath.slice(1));
  } else {
    resolved = filepath;
  }

  // Normalize path to prevent traversal
  return path.normalize(resolved);
}

/**
 * Validate that a target path is within an allowed base directory
 * Prevents path traversal attacks
 * @param basePath Base directory that target must be within
 * @param targetPath Target path to validate
 * @param errorMessage Custom error message
 * @throws SkillManagerError if target is outside base
 */
export function validatePathWithinBase(
  basePath: string,
  targetPath: string,
  errorMessage?: string
): void {
  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(targetPath);

  if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
    throw new SkillManagerError(
      errorMessage || 'Invalid path: resolves outside allowed directory',
      ERROR_CODES.VALIDATION_ERROR,
      { basePath: resolvedBase, targetPath: resolvedTarget }
    );
  }
}

/**
 * Sleep for specified milliseconds
 * @param ms Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Limit concurrent async operations
 * @param items Items to process
 * @param fn Async function to apply to each item
 * @param concurrency Maximum concurrent operations
 */
export async function pLimit<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const promise = Promise.resolve().then(async () => {
      const result = await fn(item);
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((p) => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Wrapper for async operations with spinner
 * @param operation Async operation to run
 * @param errorMessage Message to display on error
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorMessage: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof SkillManagerError) {
      throw error;
    }
    throw new SkillManagerError(
      errorMessage,
      ERROR_CODES.FILE_SYSTEM_ERROR,
      {},
      error instanceof Error ? error : undefined
    );
  }
}
