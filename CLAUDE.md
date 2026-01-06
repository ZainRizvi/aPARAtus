# Archive Project - Obsidian Plugin

## Project Overview

A PARA-aware Obsidian plugin that helps users manage their folders according to the PARA methodology (Projects, Areas, Resources, Archive).

## North Star

> **Important**: This section describes the long-term vision for this plugin. It is **not** a specification for immediate implementation. Agents should not build toward these goals unless explicitly asked. Instead, use this as a guide for:
> - Informing design decisions for current work
> - Resolving ambiguities about how features should be implemented
> - Understanding the future shape of the codebase

### Vision

This plugin simplifies two core aspects of the PARA workflow:

1. **Archiving** — Moving projects, areas, and resources that are no longer active into the Archive folder
2. **Creation** — Quickly creating new projects, areas, and resources with proper structure and templates

### Planned Capabilities

#### Creation Commands

Command palette commands for creating new PARA items:
- **Create Project** — Prompts for a name, creates a project folder with optional date prefix, applies template
- **Create Area** — Prompts for a name, creates an area folder, applies template
- **Create Resource** — Prompts for a name, creates a resource folder, applies template

Each command will:
- Create the appropriate folder in the correct PARA location
- Generate a Table of Contents note (or similar structure) within the folder
- Apply a user-customizable template using either Obsidian's core templates or Templater (based on user configuration)
- Provide sensible default templates for users who haven't customized them

#### Project Date Prefixes

Projects can optionally have their creation date prefixed to the folder name (e.g., `2024-01-15 Website Redesign`). This is configurable per-vault.

#### Project Folder Sorting

The Projects folder can be automatically sorted by user-selected criteria:
- **Disabled** — Let Obsidian or other plugins manage sort order
- **Last Modified** — Sort by the most recent modification timestamp of any file within each project
- **Date Prefix** — Sort by the date prefix in the project folder name (requires date prefixes to be enabled)

## Tech Stack

- **Language**: TypeScript
- **Bundler**: esbuild
- **Testing**: vitest
- **Linting**: ESLint with TypeScript support
- **Target**: Obsidian Desktop (CommonJS module)

## Project Structure

```
archive-project/
├── src/
│   ├── main.ts           # Plugin entry point
│   ├── settings.ts       # Settings tab and interface
│   └── utils.ts          # Pure utility functions (testable)
├── scripts/
│   └── install-dev.mjs   # Dev installation script
├── tests/
│   └── utils.test.ts     # Unit tests for pure functions
├── .beads/               # BD task tracking database
├── manifest.json         # Obsidian plugin manifest
├── versions.json         # Version compatibility mapping
├── package.json
├── tsconfig.json
├── eslint.config.mjs
├── esbuild.config.mjs
├── vitest.config.ts
├── CLAUDE.md
├── AGENTS.md
└── README.md
```

## Plugin Files

### manifest.json
Standard Obsidian plugin manifest with id, name, version, and minAppVersion.

### versions.json
Maps plugin versions to minimum required Obsidian versions.
- Format: `{ "plugin_version": "min_obsidian_version" }`
- Used by Obsidian to warn users on older versions about compatibility
- Update when releasing versions that require newer Obsidian APIs

## Key Conventions

### Code Style
- Use TypeScript strict mode
- Prefer explicit types over inference for public APIs
- Keep Obsidian API usage in main.ts; pure logic in utils.ts
- Use `normalizePath` from Obsidian for all path operations

### Testing Strategy
- Unit tests for pure functions only (utils.ts)
- Manual testing for Obsidian API integration
- Test edge cases: path normalization, collision detection

### Build Output
- `main.js` - bundled plugin code (CommonJS)
- `manifest.json` - copied to dist
- `styles.css` - optional, copied if exists

## npm Scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | Production build |
| `npm run dev` | Watch mode for development |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm test` | Run vitest unit tests |
| `npm run install:dev` | Install to test vault |

## Development Workflow

1. `npm run dev` - Start watch mode
2. In another terminal: Make changes
3. Reload Obsidian (Cmd+R) to test
4. `npm test` before committing

## Task Tracking (BD)

Use 'bd' for task tracking. Run 'bd quickstart' to understand usage.

- Always add detailed task descriptions to provide enough context for a junior dev fresh to the codebase to be able to get up to speed quickly
- When working on a task, use detailed comments via `bd comment <id> "..."` to track progress, decisions made, and blockers encountered
