/**
 * Custom error class for skill-manager with error codes and context
 */
export class SkillManagerError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;
  public readonly originalError?: Error;

  /**
   * Create a new SkillManagerError
   * @param message Human-readable error message
   * @param code Error code from ERROR_CODES
   * @param context Additional context information
   * @param originalError Original error if this is wrapping another error
   */
  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    context: Record<string, unknown> = {},
    originalError?: Error
  ) {
    super(message);
    this.code = code;
    this.context = context;
    this.originalError = originalError;
    this.name = 'SkillManagerError';

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, SkillManagerError.prototype);
  }

  /**
   * Convert error to plain object for logging
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      originalError: this.originalError
        ? {
            name: this.originalError.name,
            message: this.originalError.message,
            stack: this.originalError.stack,
          }
        : undefined,
      stack: this.stack,
    };
  }

  /**
   * Get detailed error message for user display
   */
  getDetailedMessage(): string {
    let message = this.message;
    if (Object.keys(this.context).length > 0) {
      const contextStr = Object.entries(this.context)
        .map(
          ([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`
        )
        .join(', ');
      message += ` (${contextStr})`;
    }
    return message;
  }
}

/**
 * Type guard to check if error is SkillManagerError
 */
export function isSkillManagerError(error: unknown): error is SkillManagerError {
  return error instanceof SkillManagerError;
}

/**
 * Wrap an error with additional context
 */
export function wrapError(
  error: unknown,
  message: string,
  code: string,
  context?: Record<string, unknown>
): SkillManagerError {
  const originalError = error instanceof Error ? error : new Error(String(error));
  return new SkillManagerError(message, code, context, originalError);
}
