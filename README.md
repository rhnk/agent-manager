# Skill Manager

A CLI tool to manage and sync skills across multiple AI coding agents (Antigravity, Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot) from remote Git files, folders, repositories, and Gists.

## Features

- 🔄 Sync skills from multiple sources:
  - **GIT_FILE**: Single file from a Git repository
  - **GIT_FOLDER**: Specific folder from a Git repository
  - **GIT_REPO**: Entire Git repository
  - **GIST**: GitHub Gist content
- 🤖 Multi-agent support with automatic symlink management
- 📌 Version pinning with Git refs (branches, tags, commit SHAs)
- 📌 Gist revision support (pin to specific Gist versions)
- ⚡ Smart skip checking - avoids unnecessary re-syncs
- 🔍 Local modification detection with interactive prompts
- 🎯 Centralized skill storage in `~/.agents/skills`
- 🔗 Automatic symlink creation to agent-specific directories
- 🚀 Works with `npx` - no global installation needed
- 🎨 Beautiful terminal output with progress indicators

## Installation

> **Note:** This package is not published on the npm registry.

### Clone the Repository

```bash
git clone https://github.com/rhnk/skill-manager.git
cd skill-manager
npm install
npm run build
npm link
```

Then use the command globally:

```bash
skill-manager [options] [command]
```

## Configuration

The tool looks for a configuration file in the following order (highest to lowest precedence):

1. **`--config` flag**: Explicitly specified path
2. **`SKILL_MANAGER_CONFIG_PATH` environment variable**: Path set in environment
3. **Default**: `~/.agents/skill_manager_config.json`

> **Note:** If no configuration file is found at any of these locations, the tool will display an error message with help and exit.

### Config File Format

Create a configuration file with the following structure:

```json
{
  "skillsPath": "~/.agents/skills",
  "skills": [
    {
      "my-skill": {
        "type": "GIT_FOLDER",
        "remote": "https://github.com/owner/repo/tree/main/skills/my-skill",
        "ref": "v1.2.0",
        "agents": ["cursor", "claude-code"]
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

- **skillsPath** (string, optional): Base path where skills will be synced. Supports `~` for home directory. **Defaults to `~/.agents/skills` if not specified.**
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
- **agents** (array, optional):
  - List of agents to create symlinks for
  - Valid values: `antigravity`, `claude-code`, `codex`, `cursor`, `gemini-cli`, `github-copilot`
  - If not specified, symlinks are created for all agents

### Supported Agents

| Agent | `--agent` Value | Global Path |
|-------|----------------|-------------|
| Antigravity | `antigravity` | `~/.gemini/antigravity/global_skills/` |
| Claude Code | `claude-code` | `~/.claude/skills/` |
| Codex | `codex` | `~/.codex/skills/` |
| Cursor | `cursor` | `~/.cursor/skills/` |
| Gemini CLI | `gemini-cli` | `~/.gemini/skills/` |
| GitHub Copilot | `github-copilot` | `~/.copilot/skills/` |

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

### First-Time Setup

If you have an existing setup in the form of config.json then store it at `~/.agents/skill_manager_config.json` and start using `sync`

When you add your first skill, the config file will be automatically created at `~/.agents/skill_manager_config.json`.

```bash
# Your first command will create the config automatically
npx skill-manager set --name my-skill --type GIT_FOLDER --remote https://github.com/owner/repo/tree/main/skills/my-skill
```

### Add or update a skill

Use the `set` command to add a new skill or update an existing one:

```bash
# Add a skill with all agents
npx skill-manager set --name my-skill --type GIT_FOLDER --remote https://github.com/owner/repo/tree/main/skills/my-skill

# Add a skill with specific agents
npx skill-manager set --name jira --type GIST --remote https://gist.github.com/user/gist_id --agent cursor claude-code

# Add a skill with version pinning
npx skill-manager set --name my-skill --type GIT_REPO --remote https://github.com/owner/repo --ref v2.0.0

# Add a gist with specific file and revision
npx skill-manager set --name my-gist --type GIST --remote https://gist.github.com/user/gist_id --ref abc123 --filename custom.md

# Update an existing skill with new parameters
npx skill-manager set --name my-skill --type GIT_FOLDER --remote https://github.com/owner/repo/tree/main/skills/my-skill --ref v2.0.0
```

> **Note:** The `add` command is available as an alias for `set` for backwards compatibility: `npx skill-manager add --name my-skill ...`

### List skills

```bash
# List all skills (basic view)
npx skill-manager list

# List with detailed information
npx skill-manager ls -v

# List skills for specific agent
npx skill-manager list -a cursor

# Alias
npx skill-manager ls
```

### Remove a skill

```bash
# Interactive removal (shows selection menu)
npx skill-manager remove

# Remove by name
npx skill-manager remove my-skill

# Alias
npx skill-manager rm my-skill
```

### Sync all skills

```bash
npx skill-manager sync
```

> **Default:** Uses `~/.agents/skill_manager_config.json` if no config is specified.

### Use custom config file

```bash
npx skill-manager sync --config path/to/config.json
npx skill-manager set --name my-skill --type GIST --remote url --config path/to/config.json
npx skill-manager list --config path/to/config.json
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

### Force re-sync (ignore skip checks)

Force re-sync all skills:

```bash
npx skill-manager sync --force
```

Force re-sync specific skills:

```bash
npx skill-manager sync --force skill-name1 skill-name2
```

## Smart Skip Checking

The tool automatically skips re-syncing skills when:

- The skill has an explicit `ref` (tag/commit SHA) specified
- The skill folder exists locally
- The remote URL and ref haven't changed
- No local modifications have been detected

This significantly speeds up sync operations when most skills are already up-to-date.

### Local Modification Detection

If local modifications are detected in a skill:

- **Interactive mode**: You'll be prompted to overwrite or skip
- **Non-interactive mode** (CI/CD): Skill is skipped with a warning
- **Force mode**: Local changes are overwritten

The tool stores metadata in `.skill-manager.json` files within each skill directory to track sync state.

## How Skills Are Managed

### Centralized Storage
- All skills are downloaded to `~/.agents/skills/[skill-name]`
- This is the single source of truth for all skill content

### Symlink Management
- After downloading, symlinks are automatically created in agent-specific directories
- By default, symlinks are created for all supported agents
- You can specify specific agents using the `agents` field in config or `--agent` flag

### Agent Integration
Each agent looks for skills in its own directory:
- **Cursor**: `~/.cursor/skills/`
- **Claude Code**: `~/.claude/skills/`
- **Codex**: `~/.codex/skills/`
- **Gemini CLI**: `~/.gemini/skills/`
- **Antigravity**: `~/.gemini/antigravity/global_skills/`
- **GitHub Copilot**: `~/.copilot/skills/`

The skill-manager creates symlinks in these directories pointing to `~/.agents/skills/[skill-name]`.

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
