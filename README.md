# Skill Manager

A CLI tool to manage and sync skills across multiple AI coding agents (Antigravity, Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot) from remote Git files, folders, repositories, and Gists.

## Features

- 🔄 Sync skills from multiple sources:
  - **GIT_FILE**: Single file from a Git repository
  - **GIT_FOLDER**: Specific folder from a Git repository
  - **GIT_REPO**: Entire Git repository
  - **GIST**: GitHub Gist content
- 🎯 **Auto-type detection**: Skill type is automatically inferred from URL patterns
- 🤖 Multi-agent support with automatic symlink management
- 📌 Version pinning with Git refs (branches, tags, commit SHAs)
- 📌 Gist revision support (pin to specific Gist versions)
- ⚡ Smart skip checking - avoids unnecessary re-syncs
- 🔍 Local modification detection with interactive prompts
- 🎯 Centralized skill storage in `~/.agents/skills`
- 🔗 Automatic symlink creation to agent-specific directories
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

## Usages

### Add or update a skill
Use the `set` command to add a new skill or update an existing one.

```bash
# Clone a skill
# config automatically at `~/.agents/skill_manager_config.json`, if it is not present
skill-manager set --name my-skill --remote https://github.com/owner/repo/tree/main/skills/my-skill

# Add a gist (auto-detected as GIST)
skill-manager set --name my-gist --remote https://gist.github.com/user/gist_id --agent cursor claude-code
skill-manager set --name my-gist --remote https://gist.github.com/user/gist_id --ref abc123 --filename custom.md

# Add a single file (auto-detected as GIT_FILE)
skill-manager set --name my-file --remote https://github.com/owner/repo/blob/main/path/to/file.md

# Add entire repository (auto-detected as GIT_REPO)
skill-manager set --name my-repo --remote https://github.com/owner/repo

# Update an existing skill with new parameters
skill-manager set --name my-skill --remote https://github.com/owner/repo/tree/main/skills/my-skill --ref v2.0.0
```

### List skills

```bash
# List all skills (basic view), use -v for verbose
skill-manager ls -v

# List skills for specific agent
skill-manager ls -a cursor
```

### Remove a skill

```bash
# Interactive removal (shows selection menu)
skill-manager rm

# Remove by name
skill-manager rm my-skill
```

### Sync all skills

```bash
skill-manager sync
```

### Command help

```bash
skill-manager help
skill-manager [command] --help
```

### Use custom config file

```bash
skill-manager sync --config path/to/config.json
skill-manager set --name my-skill --remote url --config path/to/config.json
skill-manager list --config path/to/config.json
```

### Use environment variable

```bash
export SKILL_MANAGER_CONFIG_PATH=/path/to/config.json
skill-manager sync
skill-manager set --name my-skill --remote https://github.com/owner/repo
```

### Dry run (preview changes)

```bash
skill-manager sync --dry-run
```

### Force re-sync (ignore skip checks)

Force re-sync all skills:

```bash
skill-manager sync --force
```

Force re-sync specific skills:

```bash
skill-manager sync --force skill-name1 skill-name2
```

### Supported Agents

| Agent | `--agent` Value | Global Path |
|-------|----------------|-------------|
| Antigravity | `antigravity` | `~/.gemini/antigravity/global_skills/` |
| Claude Code | `claude-code` | `~/.claude/skills/` |
| Codex | `codex` | `~/.codex/skills/` |
| Cursor | `cursor` | `~/.cursor/skills/` |
| Gemini CLI | `gemini-cli` | `~/.gemini/skills/` |
| GitHub Copilot | `github-copilot` | `~/.copilot/skills/` |

The skill-manager creates symlinks in these directories pointing to `~/.agents/skills/[skill-name]`.

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
    // Downloads a specific file and saves as SKILL.md in skill folder
    {
      "skill-name": {
        "type": "GIT_FILE",
        "remote": "https://github.com/owner/repo/blob/main/path/to/file.md",
        "ref": "v1.0.0", // optional, if specified it will override path in above remote URL
        "agents": ["cursor", "claude-code"]
      }
    },
    // Clones a repository and copies a specific folder to the skill folder.
    {
      "skill-name": {
        "type": "GIT_FOLDER",
        "remote": "https://github.com/owner/repo/tree/main/path/to/folder",
        "ref": "main" // optional, if specified it will override path in above remote URL
      }
    },
    // Clones an entire Git repository to the skill folder (without `.git` directory).
    {
      "skill-name": {
        "type": "GIT_REPO",
        "remote": "https://github.com/owner/repo",
        "ref": "v2.0.0" // optional, defaults to main
      }
    },
    {
      "skill-name": {
        "type": "GIST",
        "remote": "https://gist.github.com/username/gist_id",
        "ref": "abc123def456",
        "filename": "custom_skill.md"
      }
    }
    // The tool will look for files in this order:
    // 1. `SKILL.md` if it exists in the gist
    // 2. First `.md` file in the gist
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

## Development

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test
```

## Requirements

- Node.js 16 or higher
- Git (for cloning repositories)

## License

MIT
