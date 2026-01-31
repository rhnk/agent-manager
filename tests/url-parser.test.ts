import { buildRawUrl, parseGistUrl, parseGitUrl } from '../src/url-parser';

describe('URL Parser', () => {
  describe('parseGitUrl', () => {
    it('should parse GitHub file URL with blob', () => {
      const url = 'https://github.com/owner/test-repo/blob/main/skills/my-skill/SKILL.md';
      const result = parseGitUrl(url, 'GIT_FILE');

      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('test-repo');
      expect(result.ref).toBe('main');
      expect(result.path).toBe('skills/my-skill/SKILL.md');
      expect(result.type).toBe('github');
    });

    it('should parse GitHub folder URL with tree', () => {
      const url = 'https://github.com/owner/test-repo/tree/main/skills/my-skill';
      const result = parseGitUrl(url, 'GIT_FOLDER');

      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('test-repo');
      expect(result.ref).toBe('main');
      expect(result.path).toBe('skills/my-skill');
      expect(result.type).toBe('github');
    });

    it('should parse GitHub repo URL', () => {
      const url = 'https://github.com/owner/test-repo';
      const result = parseGitUrl(url, 'GIT_REPO');

      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('test-repo');
      expect(result.type).toBe('github');
    });

    it('should parse SSH URL', () => {
      const url = 'git@github.com:owner/test-repo.git';
      const result = parseGitUrl(url, 'GIT_REPO');

      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('test-repo');
      expect(result.type).toBe('github');
    });

    it('should remove .git suffix', () => {
      const url = 'https://github.com/owner/test-repo.git';
      const result = parseGitUrl(url, 'GIT_REPO');

      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('test-repo');
    });

    it('should throw error for invalid URL', () => {
      expect(() => parseGitUrl('not-a-url', 'GIT_REPO')).toThrow();
    });
  });

  describe('parseGistUrl', () => {
    it('should parse Gist URL with username', () => {
      const url = 'https://gist.github.com/joh90/54509080b47614a9218e7948497d7764';
      const result = parseGistUrl(url);

      expect(result).toBe('54509080b47614a9218e7948497d7764');
    });

    it('should parse Gist URL without username', () => {
      const url = 'https://gist.github.com/54509080b47614a9218e7948497d7764';
      const result = parseGistUrl(url);

      expect(result).toBe('54509080b47614a9218e7948497d7764');
    });

    it('should throw error for invalid Gist URL', () => {
      expect(() => parseGistUrl('https://github.com/user/repo')).toThrow('Invalid Gist URL');
    });
  });

  describe('buildRawUrl', () => {
    it('should build raw URL for GitHub', () => {
      const parsed = {
        owner: 'owner',
        repo: 'test-repo',
        ref: 'main',
        path: 'skills/my-skill/SKILL.md',
        type: 'github' as const,
      };

      const result = buildRawUrl(parsed);
      expect(result).toBe(
        'https://raw.githubusercontent.com/owner/test-repo/main/skills/my-skill/SKILL.md'
      );
    });

    it('should use main as default ref', () => {
      const parsed = {
        owner: 'owner',
        repo: 'test-repo',
        path: 'SKILL.md',
        type: 'github' as const,
      };

      const result = buildRawUrl(parsed);
      expect(result).toContain('/main/');
    });
  });
});
