# Archive Project - Obsidian Plugin

## Project Overview

A minimal PARA-aware Obsidian plugin that adds right-click context menu functionality to archive top-level project folders.

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
├── manifest.json         # Obsidian plugin manifest
├── versions.json         # Version compatibility mapping
├── package.json
├── tsconfig.json
├── eslint.config.mjs
├── esbuild.config.mjs
└── README.md
```

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

## Future Ideas

- **Project Creation Wizard**: Create new projects from templates
- **Archive Browser**: View and restore archived projects
- **Auto-archive**: Archive inactive projects after X days
- **Archive Notes**: Prompt for archive reason/notes
- **Bulk Archive**: Archive multiple projects at once
