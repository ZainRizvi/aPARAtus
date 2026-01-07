# Obsidian Plugin Anti-Patterns

A comprehensive list of anti-patterns identified from community plugin reviews by Zachatoo (Obsidian plugin reviewer). Use this as a checklist when developing or reviewing Obsidian plugins.

## Repository & Build

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Committing `main.js`, `main.js.map`, `data.json` to git | Add generated files to `.gitignore`; build artifacts should only exist in releases |
| Empty `styles.css` in repo | Remove empty CSS files - they're bloat users download unnecessarily |
| Unused dependency files in repo | Remove duplicate/unreferenced assets (e.g., copies of libs already in node_modules) |
| Including `versions.json` in releases | Release only `main.js`, `manifest.json`, and `styles.css` |
| Assuming asset files exist at runtime | Embed SVGs/assets in `main.js` via bundler or use CSS-only solutions |

## Naming & Branding

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Using "Obsidian" in plugin name or README header | Reserved for first-party products; use "X for Obsidian" if needed |
| Including "obsidian" in plugin ID | Keep IDs concise without platform name |
| Plugin description mentions "Obsidian" | Implied context; keep descriptions "short and simple" |
| Description starts with "This is a plugin that..." | Remove boilerplate; describe what it does directly |
| Description missing ending punctuation | End with period, question mark, exclamation, or parenthesis |
| Description mismatch between PR, manifest.json, and GitHub | Keep descriptions identical across all locations |

## CSS & Styling

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Generic class names (`.container`, `.hidden`, `.title`) | Prefix with plugin name (e.g., `.myplugin-container`) |
| Generic CSS variables (`--red-color`) | Prefix variables (e.g., `--myplugin-red-color`) |
| Overriding core styles (`.modal-bg`, `input[type="text"]`) | Use plugin-specific selectors only |
| Global element selectors (`button`, `select:focus`) | Scope to plugin classes |
| Creating style elements in JavaScript | Use external CSS files for theme compatibility |
| Inline styles via JavaScript (`el.style.x = y`) | Define classes in CSS file instead |

## API Usage

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| `Vault.modify()` for background changes | Use `Vault.process()` - handles race conditions |
| Async callback in `Vault.process()` | Callback must be synchronous and return content |
| Manual frontmatter parsing | Use `FileManager.processFrontMatter()` |
| Manual heading detection via string matching | Use `MetadataCache.getFileCache()` |
| `window.moment()` | Import `moment` from `"obsidian"` package |
| External `moment` package dependency | Use Obsidian's bundled moment |
| Accessing `app.getLanguage` as property | Import `getLanguage` directly from `"obsidian"` |
| Custom debounce with setTimeout | Use `debounce` from `"obsidian"` |
| Custom frontmatter extraction | Use `getFrontMatterInfo()` API |
| Direct Node.js imports (`path`, `fs`) | Use Obsidian's cross-platform APIs |
| Hardcoded config paths | Use `Vault.configDir` API |
| Type casting with `as` without validation | Use `instanceof` checks first |

## Settings UI

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Top-level heading ("Settings", "General", plugin name) | Omit; Obsidian provides context |
| `createEl("h3")` for section headings | Use `new Setting(containerEl).setName('Section').setHeading()` |
| Title Case in UI text | Use sentence case (capitalize first word only) |
| Generic terms capitalized ("Markdown Constructs") | Sentence case; only brand names keep their casing |
| Raw text input for file/folder paths | Use `AbstractInputSuggest` for autocomplete |
| Accepting paths without sanitization | Always use `normalizePath()` on user paths |

## Command Registration

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Prefixing command IDs with plugin ID | Obsidian handles namespacing automatically |
| Default hotkeys in manifest | Remove; let users set their own to avoid conflicts |
| Simple `callback` for conditional commands | Use `checkCallback` to enable/disable based on context |
| `checkCallback` when editor required | Use `editorCheckCallback` - Obsidian validates editor exists |
| Always returning true from checkCallback | Return false when preconditions aren't met |
| Relying only on ribbon icons | Also register commands for keyboard accessibility |

## Event Handling

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Global `keydown` listener | Use `registerEditorSuggest()` or `EditorExtension` |
| Listening to `active-leaf-change` + `layout-change` | Use `file-open` event (more efficient) |
| `this.scope = new Scope(app.scope)` | Add listeners to container element directly |
| Listeners on Plugin class for render children | Register DOM events on `MarkdownRenderChild` instance |

## Lifecycle Management

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| `this.register()` in `onunload()` | Move all registration to `onload()` |
| Manual DOM cleanup of modals | `activeModal.close()` handles removal |
| Detaching custom view leaves in `onunload()` | Let Obsidian handle leaf detachment |
| Redundant event listener cleanup | `contentEl.empty()` removes child listeners automatically |

## Code Quality

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Console.log in production code | Remove or gate behind development mode check |
| Excessive debug logging | Keep only error logs for production |
| Unawaited promises | Always await, use `.catch()`, or mark with `void` |
| Building HTML via string concatenation | Use `createEl()`, `createDiv()` DOM helpers |
| Using `innerHTML`/`outerHTML` | Use DOM APIs or Obsidian helper functions |

## Manifest & Metadata

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Empty `authorUrl` or `fundingUrl` | Remove empty fields entirely |
| Outdated copyright year in LICENSE | Update to current year |
| "Copyright by Dynalist Inc." for your plugin | Use your own name/entity |
| Outdated `minAppVersion` | Update to match APIs you use (check current stable) |
| Pre-release as initial submission | Must be regular release (Obsidian won't download pre-releases) |

## References

- [Official Plugin Guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
- [ESLint Plugin for Obsidian](https://github.com/obsidianmd/obsidian-api)
- Source: Reviews by Zachatoo on obsidianmd/obsidian-releases PRs
