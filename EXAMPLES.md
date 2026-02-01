# Example Configurations

This document provides various configuration examples for different use cases.

## CLI Usage Examples

### Add Command

```bash
# Add a skill with all agents
skill-manager add --name playwright --type GIT_FOLDER --remote https://github.com/microsoft/playwright/tree/main/skills/playwright

# Add a skill with specific agents only
skill-manager add --name jira --type GIST --remote https://gist.github.com/user/gist_id --agent cursor claude-code

# Add with version pinning
skill-manager add --name my-skill --type GIT_REPO --remote https://github.com/owner/repo --ref v2.0.0 --agent cursor

# Add gist with specific file and revision
skill-manager add --name custom-gist --type GIST --remote https://gist.github.com/user/id --ref abc123 --filename skill.md
```

### List Command

```bash
# List all skills (basic view)
skill-manager list

# List with detailed information (verbose)
skill-manager ls -v

# List skills for specific agent
skill-manager list -a cursor

# List with custom config
skill-manager list --config ./my-config.json
```

### Remove Command

```bash
# Interactive removal (shows menu)
skill-manager remove

# Remove specific skill
skill-manager remove jira

# Remove with alias
skill-manager rm playwright
```

### Sync Command

```bash
# Basic sync
npx skill-manager sync

# Sync with custom config
npx skill-manager sync --config ./my-config.json

# Dry run (preview without changes)
npx skill-manager sync --dry-run

# Force re-sync all skills
npx skill-manager sync --force

# Force re-sync specific skills
npx skill-manager sync --force jira playwright-mcp-repo
```

## Basic Example

```json
{
  "skillsPath": "~/.agents/skills",
  "skills": [
    {
      "my-skill": {
        "type": "GIST",
        "remote": "https://gist.github.com/username/gist_id"
      }
    }
  ]
}
```

## Multi-Agent Configuration Example

```json
{
  "skillsPath": "~/.agents/skills",
  "skills": [
    {
      "cursor-only-skill": {
        "type": "GIT_FOLDER",
        "remote": "https://github.com/owner/repo/tree/main/skills/my-skill",
        "agents": ["cursor"]
      }
    },
    {
      "shared-skill": {
        "type": "GIST",
        "remote": "https://gist.github.com/username/gist_id",
        "agents": ["cursor", "claude-code", "codex"]
      }
    },
    {
      "all-agents-skill": {
        "type": "GIT_FILE",
        "remote": "https://github.com/owner/repo/blob/main/SKILL.md"
      }
    }
  ]
}
```

## Complete Example with All Types

```json
{
  "skillsPath": "~/.agents/skills",
  "skills": [
    {
      "skill-folder": {
        "type": "GIT_FOLDER",
        "remote": "https://github.com/owner/repo/tree/main/skills/my-skill",
        "ref": "main",
        "agents": ["cursor", "claude-code"]
      }
    },
    {
      "skill-gist": {
        "type": "GIST",
        "remote": "https://gist.github.com/username/gist_id"
      }
    },
    {
      "readme-file": {
        "type": "GIT_FILE",
        "remote": "https://github.com/owner/repo/blob/main/README.md",
        "ref": "v1.0.0",
        "agents": ["cursor"]
      }
    },
    {
      "full-repo": {
        "type": "GIT_REPO",
        "remote": "https://github.com/owner/repo",
        "ref": "main"
      }
    }
  ]
}
```

## Version Pinning Examples

### Pin to Specific Tag

```json
{
  "skillsPath": "./skills",
  "skills": [
    {
      "my-skill": {
        "type": "GIT_REPO",
        "remote": "https://github.com/owner/repo",
        "ref": "v2.1.0"
      }
    }
  ]
}
```

### Pin to Branch

```json
{
  "skillsPath": "./skills",
  "skills": [
    {
      "dev-skill": {
        "type": "GIT_FOLDER",
        "remote": "https://github.com/owner/repo/tree/develop/skills",
        "ref": "develop"
      }
    }
  ]
}
```

### Pin to Commit SHA

```json
{
  "skillsPath": "./skills",
  "skills": [
    {
      "stable-skill": {
        "type": "GIT_FILE",
        "remote": "https://github.com/owner/repo/blob/main/SKILL.md",
        "ref": "abc123def456"
      }
    }
  ]
}
```

### Pin Gist to Specific Revision

```json
{
  "skillsPath": "./skills",
  "skills": [
    {
      "my-gist-skill": {
        "type": "GIST",
        "remote": "https://gist.github.com/username/gist_id",
        "ref": "a1b2c3d4e5f6"
      }
    }
  ]
}
```

### Fetch Specific File from Multi-File Gist

```json
{
  "skillsPath": "./skills",
  "skills": [
    {
      "my-gist-skill": {
        "type": "GIST",
        "remote": "https://gist.github.com/username/gist_id",
        "filename": "custom_skill.md"
      }
    }
  ]
}
```

### Gist with Both Revision and Filename

```json
{
  "skillsPath": "./skills",
  "skills": [
    {
      "my-gist-skill": {
        "type": "GIST",
        "remote": "https://gist.github.com/username/gist_id",
        "ref": "a1b2c3d4e5f6",
        "filename": "specific_version.md"
      }
    }
  ]
}
```

## Path Examples

### Use Home Directory

```json
{
  "skillsPath": "~/.config/skills",
  "skills": []
}
```

### Use Relative Path

```json
{
  "skillsPath": "./local-skills",
  "skills": []
}
```

### Use Absolute Path

```json
{
  "skillsPath": "/opt/ai-skills",
  "skills": []
}
```

## Multiple Skills of Same Type

```json
{
  "skillsPath": "./skills",
  "skills": [
    {
      "skill-a": {
        "type": "GIST",
        "remote": "https://gist.github.com/user/gist_id_1"
      }
    },
    {
      "skill-b": {
        "type": "GIST",
        "remote": "https://gist.github.com/user/gist_id_2"
      }
    },
    {
      "skill-c": {
        "type": "GIST",
        "remote": "https://gist.github.com/user/gist_id_3"
      }
    }
  ]
}
```
