# Archive Project

An Obsidian plugin that adds a right-click context menu to archive top-level project folders in a PARA-style workflow.

## Features

- **Context Menu Integration**: Right-click any top-level project folder to see "Archive it" option
- **PARA-Aware**: Only shows on direct children of your configured Projects folder
- **Smart Naming**: Handles destination collisions with date suffixes and counters
- **Focus Management**: Optionally returns focus to Projects folder after archiving

## Installation

### From Obsidian Community Plugins

*Coming soon*

### Manual Installation

1. Download `main.js` and `manifest.json` from the latest release
2. Create folder: `<vault>/.obsidian/plugins/archive-project/`
3. Copy the files into that folder
4. Enable the plugin in Obsidian Settings > Community plugins

## Configuration

Open Settings > Archive Project to configure:

| Setting | Default | Description |
|---------|---------|-------------|
| Projects folder | `Projects` | Path to your top-level projects folder |
| Archive folder | `Archive` | Where archived projects are moved |
| Focus after archive | `true` | Return focus to Projects folder after archiving |

## Usage

1. Create your folder structure:
   ```
   Vault/
   ├── Projects/
   │   ├── Project-A/
   │   └── Project-B/
   └── Archive/
   ```

2. Right-click on a project folder (e.g., `Project-A`)
3. Click "Archive it"
4. The folder moves to `Archive/Project-A`

### Collision Handling

If `Archive/Project-A` already exists:
1. First tries: `Archive/Project-A (Archived 2024-03-15)`
2. Then: `Archive/Project-A (Archived 2024-03-15) (2)`, etc.

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
npm install
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Watch mode - rebuilds on changes |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm test` | Run unit tests |
| `npm run install:dev` | Install to test vault |

### Development Workflow

1. Start watch mode:
   ```bash
   npm run dev
   ```

2. Install to your test vault (in another terminal):
   ```bash
   npm run install:dev
   ```

   Or specify a custom vault:
   ```bash
   npm run install:dev -- --vault "/path/to/your/vault"
   ```

3. In Obsidian:
   - Enable Community plugins (if not already)
   - Enable "Archive Project" plugin
   - Reload (Cmd+R / Ctrl+R) after changes

### Install to Test Vault

Default vault: `/Users/zain/test/PluginDev/TEST_Vault`

```bash
npm run install:dev
```

This copies `manifest.json`, `main.js`, and `styles.css` (if present) to:
```
/Users/zain/test/PluginDev/TEST_Vault/.obsidian/plugins/archive-project/
```

## Manual Test Checklist

After installing, verify these behaviors in Obsidian:

### Setup
- [ ] Create `Projects/` folder if it doesn't exist
- [ ] Create `Archive/` folder if it doesn't exist
- [ ] Create a test project: `Projects/TestProject/` with some files

### Context Menu
- [ ] Right-click `Projects/TestProject/` → "Archive it" appears
- [ ] Right-click `Projects/` itself → "Archive it" does NOT appear
- [ ] Right-click `Projects/TestProject/SubFolder/` → "Archive it" does NOT appear
- [ ] Right-click a file → "Archive it" does NOT appear

### Archive Behavior
- [ ] Click "Archive it" → folder moves to `Archive/TestProject/`
- [ ] Notice appears: "Archived 'TestProject' to Archive/TestProject"
- [ ] Focus returns to Projects folder (if setting enabled)

### Collision Handling
- [ ] Archive same-named project again → creates `Archive/TestProject (Archived YYYY-MM-DD)`
- [ ] Archive again → creates `Archive/TestProject (Archived YYYY-MM-DD) (2)`

### Settings
- [ ] Settings tab appears under plugin settings
- [ ] Changing "Projects folder" affects which folders show menu
- [ ] Changing "Archive folder" changes destination
- [ ] Toggle "Focus after archive" works

## License

MIT
