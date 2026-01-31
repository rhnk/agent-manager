import { IFetcher, SkillType } from './types';
import { fetchGitFile } from './fetchers/git-file';
import { fetchGitFolder } from './fetchers/git-folder';
import { fetchGitRepo } from './fetchers/git-repo';
import { fetchGist } from './fetchers/gist';
import { SkillManagerError } from './errors';
import { ERROR_CODES } from './constants';

/**
 * Factory class to create fetchers based on skill type
 * Implements Open/Closed Principle - open for extension, closed for modification
 */
export class FetcherFactory {
  private static fetchers: Map<SkillType, IFetcher> = new Map([
    [
      'GIT_FILE',
      {
        fetch: fetchGitFile,
      } as IFetcher,
    ],
    [
      'GIT_FOLDER',
      {
        fetch: fetchGitFolder,
      } as IFetcher,
    ],
    [
      'GIT_REPO',
      {
        fetch: fetchGitRepo,
      } as IFetcher,
    ],
    [
      'GIST',
      {
        fetch: fetchGist,
      } as IFetcher,
    ],
  ]);

  /**
   * Get fetcher for a skill type
   * @param type The skill type
   * @returns The fetcher instance
   * @throws SkillManagerError if type is unsupported
   */
  static getFetcher(type: SkillType): IFetcher {
    const fetcher = this.fetchers.get(type);
    if (!fetcher) {
      throw new SkillManagerError(`Unsupported skill type: ${type}`, ERROR_CODES.VALIDATION_ERROR, {
        type,
        supportedTypes: Array.from(this.fetchers.keys()),
      });
    }
    return fetcher;
  }

  /**
   * Register a custom fetcher for extension
   * @param type The skill type to register
   * @param fetcher The fetcher implementation
   */
  static registerFetcher(type: SkillType, fetcher: IFetcher): void {
    this.fetchers.set(type, fetcher);
  }

  /**
   * Get all registered fetcher types
   */
  static getSupportedTypes(): SkillType[] {
    return Array.from(this.fetchers.keys());
  }
}
