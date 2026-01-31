# Skill Manager

A CLI tool to sync remote Git files, folders, repositories, and Gists to local skill folders based on a configuration file.

## Features

- 🔄 Sync skills from multiple sources:
  - **GIT_FILE**: Single file from a Git repository
  - **GIT_FOLDER**: Specific folder from a Git repository
  - **GIT_REPO**: Entire Git repository
  - **GIST**: GitHub Gist content
- 📌 Version pinning with Git refs (branches, tags, commit SHAs)
- 📌 Gist revision support (pin to specific Gist versions)
- 🎯 Configurable skill paths with home directory support (`~`)
- 🚀 Works with `npx` - no global installation needed
- 🎨 Beautiful terminal output with progress indicators

## Installation

### Using npx (Recommended)

No installation needed! Just run:

```bash
npx skill-manager sync
```

### Global Installation

```bash
npm install -g skill-manager
skill-manager sync
```

### Local Development

```bash
npm install
npm run build
npm link
```

## Configuration

The tool looks for a configuration file in the following order (highest to lowest precedence):

1. **`--config` flag**: Explicitly specified path
2. **`SKILL_MANAGER_CONFIG_PATH` environment variable**: Path set in environment
3. **Default**: `~/.claude/skill_manager_config.json`

> **Note:** If no configuration file is found at any of these locations, the tool will display an error message with help and exit.

### Config File Format

Create a configuration file with the following structure:

```json
{
  "skillsPath": "~/.claude/skills", // optional, default to ~/.claude/skills
  "skills": [
    {
      "my-skill": {
        "type": "GIT_FOLDER",
        "remote": "https://github.com/owner/repo/tree/main/skills/my-skill",
        "ref": "v1.2.0"
      }
    },
    {
      "jira": {
        "type": "GIST",
        "remote": "https://gist.github.com/joh90/54509080b47614a9218e7948497d7764"
      }
    }
  ]
}
```

### Config Schema

- **skillsPath** (string, optional): Base path where skills will be synced. Supports `~` for home directory. **Defaults to `~/.claude/skills` if not specified.**
- **skills** (array, required): Array of skill configurations.

Each skill object has:

- **type** (string, required): One of `GIT_FILE`, `GIT_FOLDER`, `GIT_REPO`, or `GIST`
- **remote** (string, required): URL to the remote source
- **ref** (string, optional):
  - For Git types: Branch name, tag, or commit SHA
  - For GIST: Gist revision SHA (commit hash from Gist history)
  - **Note:** If `ref` is specified in config, it takes precedence over any ref in the URL
- **filename** (string, optional):
  - For GIST type only: Specific file to fetch from multi-file gists
  - Example: `"filename": "my_skill.md"`
  - If not specified, defaults to `SKILL.md`, then first `.md` file

### Version Ref Precedence

When working with Git sources, the `ref` field follows this priority:

1. **Config `ref` field** (highest priority) - Always used if specified
2. **URL-embedded ref** - Used if present in URL (e.g., `/tree/v1.0.0/`) and no config `ref`
3. **Default `main` branch** - Used if neither above is specified

**Example:**

```json
{
  "my-skill": {
    "type": "GIT_FOLDER",
    "remote": "https://github.com/owner/repo/tree/v1.0.0/folder",
    "ref": "v2.0.0"
  }
}
```

This will fetch from `v2.0.0` branch/tag, **not** `v1.0.0` from the URL.

## Usage

### Sync all skills

```bash
npx skill-manager sync
```

> **Default:** Uses `~/.claude/skill_manager_config.json` if no config is specified.

### Use custom config file

```bash
npx skill-manager sync --config path/to/config.json
```

### Use environment variable

```bash
export SKILL_MANAGER_CONFIG_PATH=/path/to/config.json
npx skill-manager sync
```

### Dry run (preview changes)

```bash
npx skill-manager sync --dry-run
```

## Skill Types

### GIT_FILE

Downloads a single file from a Git repository and saves it as `SKILL.md` in the skill folder.

```json
{
  "skill-name": {
    "type": "GIT_FILE",
    "remote": "https://github.com/owner/repo/blob/main/path/to/file.md",
    "ref": "v1.0.0" // optional, if specified it will override path in above remote URL
  }
}
```

### GIT_FOLDER

Clones a repository and copies a specific folder to the skill folder.

```json
{
  "skill-name": {
    "type": "GIT_FOLDER",
    "remote": "https://github.com/owner/repo/tree/main/path/to/folder",
    "ref": "main" // optional, if specified it will override path in above remote URL
  }
}
```

### GIT_REPO

Clones an entire Git repository to the skill folder (without `.git` directory).

```json
{
  "skill-name": {
    "type": "GIT_REPO",
    "remote": "https://github.com/owner/repo",
    "ref": "v2.0.0" // optional, defaults to main
  }
}
```

### GIST

Fetches a GitHub Gist and saves the content as `SKILL.md` in the skill folder.

**Basic usage:**

```json
{
  "skill-name": {
    "type": "GIST",
    "remote": "https://gist.github.com/username/gist_id"
  }
}
```

The tool will look for files in this order:

1. `SKILL.md` if it exists in the gist
2. First `.md` file in the gist

**With specific revision and file:**

```json
{
  "skill-name": {
    "type": "GIST",
    "remote": "https://gist.github.com/username/gist_id",
    "ref": "abc123def456",
    "filename": "custom_skill.md"
  }
}
```

**With specific filename (for multi-file gists):**

```json
{
  "skill-name": {
    "type": "GIST",
    "remote": "https://gist.github.com/username/gist_id",
    "filename": "my_skill.md"
  }
}
```

**With both revision and filename:**

```json
{
  "skill-name": {
    "type": "GIST",
    "remote": "https://gist.github.com/username/gist_id",
    "ref": "abc123def456",
    "filename": "custom_skill.md"
  }
}
```

> **Note:** To find a Gist revision SHA, go to the Gist page on GitHub, click "Revisions" at the top right, and copy the commit hash from the history.

## Development

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test
```

### Watch Mode

```bash
npm run dev
```

## Requirements

- Node.js 16 or higher
- Git (for cloning repositories)

## License

MIT
