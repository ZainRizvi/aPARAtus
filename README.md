# aPARAtus

> *The right gear for organizing your second brain.*

An Obsidian plugin for managing PARA folders (Projects, Areas, Resources, Archive). Quickly create new items and archive completed ones with ease.

## About PARA

The PARA method organizes your vault into four categories:
- **Projects**: Time-bound efforts with a specific outcome
- **Areas**: Ongoing responsibilities you care about
- **Resources**: Information collected for potential future use
- **Archive**: Completed or inactive items from above

For more information, see [Building a Second Brain by Tiago Forte](https://www.buildingasecondbrain.com/).

## Features

### Create Commands
- **Create Project**: Quickly create new projects with optional date prefixes (configurable format)
- **Create Area**: Quickly create new areas
- **Create Resource**: Quickly create new resources
- Each command creates a folder, generates an index note, and opens it for immediate editing

### Archive & Organization
- **Context Menu Integration**: Right-click any top-level item to see "Archive it" option
- **PARA-Aware**: Works across all configured PARA folders (Projects, Areas, Resources)
- **Smart Naming**: Handles destination collisions with date suffixes and counters
- **Focus Management**: Optionally returns focus to the source folder after archiving
- **Organized Archives**: Items are organized into subfolders by type (Archive/Projects, Archive/Areas, Archive/Resources)

## Installation

### From Obsidian Community Plugins

*Coming soon*

### Manual Installation

1. Download `main.js` and `manifest.json` from the latest release
2. Create folder: `<vault>/.obsidian/plugins/aparatus/`
3. Copy the files into that folder
4. Enable the plugin in Obsidian Settings > Community plugins

## Configuration

Open Settings > aPARAtus to configure:

| Setting | Default | Description |
|---------|---------|-------------|
| Projects folder | `Projects` | Path to your top-level projects folder |
| Areas folder | `Areas` | Path to your top-level areas folder |
| Resources folder | `Resources` | Path to your top-level resources folder |
| Archive folder | `Archive` | Where archived items are moved |
| Project folder format | `YYYY-MM-DD {{name}}` | Template for project folder names. Use `{{name}}` for the project name and [Moment.js tokens](https://momentjs.com/docs/#/displaying/format/) for dates (YYYY, MM, DD, etc.) |
| Focus source folder after archive | `true` | Return focus to the source folder after archiving |
| Confirm before archiving | `false` | Show confirmation dialog before archiving |

## Usage

### Command Palette

Access all commands via the Command Palette (Cmd+P / Ctrl+P):
- **Create Project** — Opens a dialog to name your new project
- **Create Area** — Opens a dialog to name your new area
- **Create Resource** — Opens a dialog to name your new resource
- **Archive Item** — Archives the current file or its top-level folder

### Custom Hotkeys

You can set custom hotkeys for any command:
1. Go to Settings > Hotkeys
2. Search for "aPARAtus" or the specific command
3. Click to set your preferred key combination

Example hotkeys you might use:
- `Ctrl+Alt+P` — Create Project
- `Ctrl+Alt+A` — Create Area
- `Ctrl+Alt+R` — Create Resource

### Creating Items

#### Create a Project

1. Open Command Palette (Cmd+P / Ctrl+P)
2. Run "Create Project"
3. Enter a name (e.g., "Website Redesign")
4. A folder is created at `Projects/2024-01-15 Website Redesign/` (date prefix based on your format)
5. An `index.md` note is created and opened
6. Edit the note immediately to add project details

#### Create an Area

1. Open Command Palette
2. Run "Create Area"
3. Enter a name (e.g., "Health & Fitness")
4. A folder is created at `Areas/Health & Fitness/`
5. An `index.md` note is created and opened

#### Create a Resource

1. Open Command Palette
2. Run "Create Resource"
3. Enter a name (e.g., "TypeScript Guide")
4. A folder is created at `Resources/TypeScript Guide/`
5. An `index.md` note is created and opened

### Archiving Items

1. In the file explorer, right-click on any top-level project, area, or resource folder
2. Select "Archive it"
3. The folder moves to the appropriate subfolder in Archive:
   - Project folders move to `Archive/Projects/`
   - Area folders move to `Archive/Areas/`
   - Resource folders move to `Archive/Resources/`

#### Collision Handling

If the destination already exists, the plugin automatically handles naming:
1. First tries: `Archive/Projects/Website Redesign (Archived 2024-03-15)`
2. Then: `Archive/Projects/Website Redesign (Archived 2024-03-15) (2)`, etc.

### Example Vault Structure

```
Vault/
├── Projects/
│   ├── 2024-01-15 Website Redesign/
│   │   ├── index.md
│   │   └── design-notes.md
│   └── 2024-02-20 Mobile App/
│       ├── index.md
│       └── requirements.md
├── Areas/
│   ├── Health & Fitness/
│   │   └── index.md
│   └── Learning/
│       └── index.md
├── Resources/
│   ├── TypeScript Guide/
│   │   └── index.md
│   └── Design Patterns/
│       └── index.md
└── Archive/
    ├── Projects/
    │   ├── Website Redesign (Archived 2024-03-15)/
    │   └── Old Mobile App (Archived 2024-03-20)/
    ├── Areas/
    └── Resources/
```

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

   Or set the OBSIDIAN_TEST_VAULT environment variable:
   ```bash
   export OBSIDIAN_TEST_VAULT="/path/to/your/vault"
   npm run install:dev
   ```

3. In Obsidian:
   - Enable Community plugins (if not already)
   - Enable "aPARAtus" plugin
   - Reload (Cmd+R / Ctrl+R) after changes

## Manual Test Checklist

After installing, verify these behaviors in Obsidian:

### Setup
- [ ] Create `Projects/`, `Areas/`, `Resources/`, and `Archive/` folders
- [ ] Create some test content folders in each PARA folder

### Create Commands
- [ ] Open Command Palette and run "Create Project"
- [ ] Enter a name and verify folder created in `Projects/` with date prefix
- [ ] Verify `index.md` was created and opened
- [ ] Open Command Palette and run "Create Area"
- [ ] Enter a name and verify folder created in `Areas/`
- [ ] Verify `index.md` was created and opened
- [ ] Open Command Palette and run "Create Resource"
- [ ] Enter a name and verify folder created in `Resources/`
- [ ] Verify `index.md` was created and opened
- [ ] Test project folder format: edit setting to customize date format (e.g., `MM-DD-YYYY {{name}}`)
- [ ] Create another project and verify new format is applied

### Context Menu - Archive
- [ ] Right-click a project folder → "Archive it" appears
- [ ] Right-click an area folder → "Archive it" appears
- [ ] Right-click a resource folder → "Archive it" appears
- [ ] Right-click the root source folder → "Archive it" does NOT appear
- [ ] Right-click nested folders → "Archive it" does NOT appear
- [ ] Right-click a file → "Archive it" appears (files can be archived individually)

### Archive Behavior
- [ ] Click "Archive it" on a project → folder moves to `Archive/Projects/`
- [ ] Click "Archive it" on an area → folder moves to `Archive/Areas/`
- [ ] Click "Archive it" on a resource → folder moves to `Archive/Resources/`
- [ ] Notice appears with archive confirmation
- [ ] Focus returns to source folder (if setting enabled)

### Collision Handling
- [ ] Archive same-named project again → creates `Archive/Projects/ProjectName (Archived YYYY-MM-DD)`
- [ ] Archive again → creates `Archive/Projects/ProjectName (Archived YYYY-MM-DD) (2)`

### Settings
- [ ] Settings tab appears under plugin settings
- [ ] Folder path inputs show autocomplete suggestions
- [ ] Changing folder paths affects archiving destinations and menu visibility
- [ ] Folder format preview shows real-time updates
- [ ] Toggle settings save and persist across reloads

### Hotkeys
- [ ] Go to Settings > Hotkeys and search for "Create Project"
- [ ] Assign a custom hotkey and verify it works in command palette

## License

MIT
