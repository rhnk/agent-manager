import { z } from 'zod';

/**
 * Zod schemas for runtime validation of configuration
 */

export const AgentTypeSchema = z.enum([
  'antigravity',
  'claude-code',
  'codex',
  'cursor',
  'gemini-cli',
  'github-copilot',
]);

export const SkillTypeSchema = z.enum(['GIT_FILE', 'GIT_FOLDER', 'GIT_REPO', 'GIST']);

const BaseSkillConfigSchema = z.object({
  remote: z.string().min(1, 'Remote URL cannot be empty'),
  agents: z.array(AgentTypeSchema).optional(),
});

export const GitFileConfigSchema = BaseSkillConfigSchema.extend({
  type: z.literal('GIT_FILE'),
  ref: z.string().optional(),
});

export const GitFolderConfigSchema = BaseSkillConfigSchema.extend({
  type: z.literal('GIT_FOLDER'),
  ref: z.string().optional(),
});

export const GitRepoConfigSchema = BaseSkillConfigSchema.extend({
  type: z.literal('GIT_REPO'),
  ref: z.string().optional(),
});

export const GistConfigSchema = BaseSkillConfigSchema.extend({
  type: z.literal('GIST'),
  ref: z.string().optional(),
  filename: z.string().optional(),
});

export const SkillConfigSchema = z.discriminatedUnion('type', [
  GitFileConfigSchema,
  GitFolderConfigSchema,
  GitRepoConfigSchema,
  GistConfigSchema,
]);

export const ConfigSchema = z.object({
  skillsPath: z.string().optional(),
  skills: z
    .array(
      z
        .record(z.string(), SkillConfigSchema)
        .refine(
          (obj) => Object.keys(obj).length === 1,
          'Each skill entry must have exactly one key'
        )
    )
    .min(1, 'Config must have at least one skill'),
});

// Type inference from schemas
export type ValidatedConfig = z.infer<typeof ConfigSchema>;
export type ValidatedSkillConfig = z.infer<typeof SkillConfigSchema>;
