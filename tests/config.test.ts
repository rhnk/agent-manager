import { loadConfig, resolveHomePath, validateSkillConfig } from '../src/config';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('Config Loader', () => {
  describe('resolveHomePath', () => {
    it('should resolve ~ to home directory', () => {
      const result = resolveHomePath('~/test/path');
      expect(result).toBe(path.join(os.homedir(), 'test/path'));
    });

    it('should resolve single ~ to home directory', () => {
      const result = resolveHomePath('~');
      expect(result).toBe(os.homedir());
    });

    it('should not modify paths without ~', () => {
      const result = resolveHomePath('/absolute/path');
      expect(result).toBe('/absolute/path');
    });
  });

  describe('validateSkillConfig', () => {
    it('should pass for valid config', () => {
      const config = {
        type: 'GIT_FILE',
        remote: 'https://github.com/user/repo/blob/main/file.md',
      };

      expect(() => validateSkillConfig('test-skill', config)).not.toThrow();
    });

    it('should throw for missing type', () => {
      const config = {
        remote: 'https://github.com/user/repo',
      };

      expect(() => validateSkillConfig('test-skill', config)).toThrow('missing "type" field');
    });

    it('should throw for invalid type', () => {
      const config = {
        type: 'INVALID_TYPE',
        remote: 'https://github.com/user/repo',
      };

      expect(() => validateSkillConfig('test-skill', config)).toThrow('invalid type');
    });

    it('should throw for missing remote', () => {
      const config = {
        type: 'GIT_FILE',
      };

      expect(() => validateSkillConfig('test-skill', config)).toThrow('missing "remote" field');
    });
  });

  describe('loadConfig', () => {
    const testConfigPath = path.join(__dirname, 'test-config.json');

    beforeEach(async () => {
      const testConfig = {
        skillsPath: '~/test-skills',
        skills: [
          {
            'test-skill': {
              type: 'GIT_FILE',
              remote: 'https://github.com/user/repo/blob/main/file.md',
            },
          },
        ],
      };

      await fs.writeJson(testConfigPath, testConfig);
    });

    afterEach(async () => {
      await fs.remove(testConfigPath);
    });

    it('should load and parse config file', async () => {
      const config = await loadConfig(testConfigPath);

      expect(config.skills).toHaveLength(1);
      expect(config.skillsPath).toBe(path.join(os.homedir(), 'test-skills'));
    });

    it('should use default skillsPath when not provided', async () => {
      const configWithoutPath = {
        skills: [
          {
            'test-skill': {
              type: 'GIT_FILE',
              remote: 'https://github.com/user/repo/blob/main/file.md',
            },
          },
        ],
      };
      const noPathConfigPath = path.join(__dirname, 'test-config-no-path.json');
      await fs.writeJson(noPathConfigPath, configWithoutPath);

      const config = await loadConfig(noPathConfigPath);

      expect(config.skillsPath).toBe(path.join(os.homedir(), '.agents/skills'));

      await fs.remove(noPathConfigPath);
    });

    it('should throw for non-existent file', async () => {
      await expect(loadConfig('non-existent.json')).rejects.toThrow('Config file not found');
    });

    it('should throw for config without skills array', async () => {
      const badConfig = { skillsPath: '~/test' };
      const badConfigPath = path.join(__dirname, 'bad-config.json');
      await fs.writeJson(badConfigPath, badConfig);

      await expect(loadConfig(badConfigPath)).rejects.toThrow('must include "skills" array');

      await fs.remove(badConfigPath);
    });
  });
});
