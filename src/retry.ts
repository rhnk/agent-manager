import { ERROR_CODES, HTTP_CONFIG } from './constants';
import { SkillManagerError } from './errors';

/**
 * Configuration for retry logic
 */
export interface RetryConfig {
  maxRetries?: number;
  initialBackoff?: number;
  maxBackoff?: number;
  backoffMultiplier?: number;
  isRetryable?: (error: Error) => boolean;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: HTTP_CONFIG.MAX_RETRIES,
  initialBackoff: HTTP_CONFIG.INITIAL_BACKOFF,
  maxBackoff: HTTP_CONFIG.MAX_BACKOFF,
  backoffMultiplier: 2,
  isRetryable: (error: Error) => {
    // Retry on network errors, timeouts, and 5xx errors
    // Don't retry on validation errors, 4xx (except 429), auth failures
    const message = error.message;
    return (
      message.includes('ECONNRESET') ||
      message.includes('ETIMEDOUT') ||
      message.includes('EHOSTUNREACH') ||
      message.includes('ECONNREFUSED') ||
      message.includes('socket hang up') ||
      message.includes('429') || // Rate limit
      message.includes('503') || // Service unavailable
      message.includes('502') || // Bad gateway
      message.includes('504') // Gateway timeout
    );
  },
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate backoff delay with exponential backoff
 */
function calculateBackoff(attempt: number, config: Required<RetryConfig>): number {
  const exponentialDelay = config.initialBackoff * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(exponentialDelay, config.maxBackoff);
}

/**
 * Retry an async operation with exponential backoff
 * Generic error handling wrapper
 * @param operation The async operation to retry
 * @param operationName Name for logging
 * @param config Retry configuration
 * @returns Promise with the operation result
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string = 'operation',
  config: RetryConfig = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (attempt >= finalConfig.maxRetries || !finalConfig.isRetryable(lastError)) {
        throw error;
      }

      // Calculate backoff and wait
      const backoffMs = calculateBackoff(attempt, finalConfig);
      console.log(
        `Retry attempt ${attempt}/${finalConfig.maxRetries} for ${operationName}. Waiting ${backoffMs}ms...`
      );
      await sleep(backoffMs);
    }
  }

  // Should never reach here, but just in case
  throw lastError || new Error(`${operationName} failed after ${finalConfig.maxRetries} retries`);
}

/**
 * Retry an async operation with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = HTTP_CONFIG.TIMEOUT
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new SkillManagerError(
              `Operation timeout after ${timeoutMs}ms`,
              ERROR_CODES.NETWORK_ERROR,
              { timeoutMs }
            )
          ),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Combine retry and timeout
 */
export async function withRetryAndTimeout<T>(
  operation: () => Promise<T>,
  operationName: string = 'operation',
  retryConfig: RetryConfig = {},
  timeoutMs: number = HTTP_CONFIG.TIMEOUT
): Promise<T> {
  return withRetry(() => withTimeout(operation(), timeoutMs), operationName, retryConfig);
}

/**
 * Wrapper to handle errors consistently
 * Converts unknown errors to SkillManagerError
 */
export function wrapWithErrorHandling<T extends unknown[]>(
  fn: (...args: T) => Promise<unknown>,
  errorMessage: string,
  errorCode: string = ERROR_CODES.FILE_SYSTEM_ERROR
) {
  return async (...args: T): Promise<unknown> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof SkillManagerError) {
        throw error;
      }
      throw new SkillManagerError(
        errorMessage,
        errorCode,
        {},
        error instanceof Error ? error : undefined
      );
    }
  };
}
