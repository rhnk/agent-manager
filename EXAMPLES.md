# Example Configurations

This document provides various configuration examples for different use cases.

## Basic Example

```json
{
  "skillsPath": "~/.claude/skills",
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

## Complete Example with All Types

```json
{
  "skillsPath": "~/.claude/skills",
  "skills": [
    {
      "skill-folder": {
        "type": "GIT_FOLDER",
        "remote": "https://github.com/owner/repo/tree/main/skills/my-skill",
        "ref": "main"
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
        "ref": "v1.0.0"
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
