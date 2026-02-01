import path from 'path';
import fs from 'fs-extra';
import { SkillConfig, SkipCheckResult } from './types';
import { calculateContentHash, loadMetadata, metadataExists } from './metadata-manager';
import { parseGitUrl, resolveRef } from './url-parser';

/**
 * Determine if a skill sync should be skipped
 *
 * Skip conditions:
 * 1. Skill directory exists
 * 2. Metadata file exists and is valid
 * 3. Explicit ref is specified in config (not tracking branch HEAD)
 * 4. Remote URL matches
 * 5. Ref matches
 * 6. Type matches
 * 7. Content hash matches (no local modifications)
 *
 * @param skillName Name of the skill
 * @param config Skill configuration
 * @param skillsPath Base path for skills
 * @returns Skip check result with decision and reason
 */
export async function shouldSkipSync(
  skillName: string,
  config: SkillConfig,
  skillsPath: string
): Promise<SkipCheckResult> {
  const skillDir = path.join(skillsPath, skillName);

  // 1. Check if skill directory exists
  if (!(await fs.pathExists(skillDir))) {
    return { shouldSkip: false, reason: 'skill directory does not exist' };
  }

  // 2. Check if metadata file exists
  if (!(await metadataExists(skillDir))) {
    return { shouldSkip: false, reason: 'no metadata found (first-time sync)' };
  }

  // 3. Check if explicit ref is specified in config
  // If no ref, we might be tracking a branch HEAD, so always sync
  const hasExplicitRef = await hasExplicitRefInConfig(config);
  if (!hasExplicitRef) {
    return { shouldSkip: false, reason: 'no explicit ref specified (tracking branch)' };
  }

  // 4. Load and validate metadata
  const metadata = await loadMetadata(skillDir);
  if (!metadata) {
    return { shouldSkip: false, reason: 'metadata is invalid or corrupted' };
  }

  // 5. Compare remote URL
  if (metadata.remote !== config.remote) {
    return { shouldSkip: false, reason: 'remote URL has changed' };
  }

  // 6. Compare type
  if (metadata.type !== config.type) {
    return { shouldSkip: false, reason: 'skill type has changed' };
  }

  // 7. Compare ref (resolve the same way fetchers do)
  const currentRef = resolveRefForSkill(config);
  if (metadata.ref !== currentRef) {
    return { shouldSkip: false, reason: `ref has changed (${metadata.ref} → ${currentRef})` };
  }

  // 8. Check for local modifications by comparing content hash
  try {
    const currentHash = await calculateContentHash(skillDir);
    if (metadata.contentHash !== currentHash) {
      // Local modifications detected
      return {
        shouldSkip: false,
        reason: 'local modifications detected',
        needsInteraction: true,
      };
    }
  } catch (error) {
    // If hash calculation fails, err on the side of syncing
    console.warn(`Failed to calculate content hash for ${skillName}:`, error);
    return { shouldSkip: false, reason: 'failed to verify content integrity' };
  }

  // All checks passed - safe to skip
  return {
    shouldSkip: true,
    reason: `already synced to ${currentRef}`,
  };
}

/**
 * Check if config has an explicit ref specified
 * For Git types, check both config.ref and URL-embedded ref
 * For GIST, only config.ref matters (revision SHA)
 *
 * @param config Skill configuration
 * @returns True if explicit ref is present
 */
async function hasExplicitRefInConfig(config: SkillConfig): Promise<boolean> {
  // If config.ref is explicitly set, that's an explicit ref
  if (config.ref) {
    return true;
  }

  // For Git types, check if URL has embedded ref
  if (config.type === 'GIT_FILE' || config.type === 'GIT_FOLDER') {
    try {
      const parsed = parseGitUrl(config.remote, config.type);
      // If URL has a ref embedded (like /tree/v1.0.0/ or /blob/main/)
      if (parsed.ref) {
        return true;
      }
    } catch {
      // If parsing fails, assume no explicit ref
      return false;
    }
  }

  // For GIT_REPO without explicit ref, assume tracking branch
  if (config.type === 'GIT_REPO') {
    return false;
  }

  // For GIST without ref, tracking latest
  if (config.type === 'GIST') {
    return false;
  }

  return false;
}

/**
 * Resolve the ref that will be used for this skill
 * Must match the logic in fetchers to ensure consistency
 *
 * @param config Skill configuration
 * @returns Resolved ref string
 */
function resolveRefForSkill(config: SkillConfig): string | undefined {
  // For GIST, ref is the revision SHA (optional)
  if (config.type === 'GIST') {
    return config.ref; // undefined if not specified
  }

  // For Git types, resolve with precedence: config > url > default
  try {
    const parsed = parseGitUrl(config.remote, config.type);
    return resolveRef(config.ref, parsed.ref);
  } catch {
    // If parsing fails, use config.ref or undefined
    return config.ref;
  }
}
