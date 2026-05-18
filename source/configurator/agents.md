# Configurator — Agent Guidance

Browser-based configuration UI for OpenIRis. See [../../agents.md](../../agents.md) for project-wide standards that also apply here.

## Tech stack

- **Language:** TypeScript (strict mode)
- **UI framework:** Svelte 5
- **Component library:** Skeleton v4 (`@skeletonlabs/skeleton` + `@skeletonlabs/skeleton-svelte`)
- **Icons:** Lucide (`@lucide/svelte`)
- **CSS:** Tailwind CSS v4 (via `@tailwindcss/vite`) + `@tailwindcss/forms` plugin
- **Build tool:** Vite 6

## Project structure

```
src/
  App.svelte              Root component
  main.ts                 Entry point
  app-config.ts           Runtime app configuration type
  app.css                 Global stylesheet — imports Tailwind, Skeleton, fonts, theme
  components/             Svelte UI components  (@components alias)
  layout/                 Layout descriptor loading and types  (@layout alias)
  model/                  Domain model types (button codes, contexts, etc.)  (@model alias)
  serialization/          Binary .iris format reader and writer  (@serialization alias)
  styles/
    theme-open-iris.css   Skeleton v4 theme — full OKLCH color palette, typography, radius
public/
  app-config.json         Runtime config loaded at startup
layouts/
  <id>.toml               Layout descriptor — one file per hardware variant (SVG embedded)
```

### Layout file format

Each hardware variant is a single `<id>.toml` file directly in `layouts/`. The SVG is embedded as the `svg` field (a TOML multiline string) — there is no separate `.svg` file. Parsed by `smol-toml` in `layout-loader.ts`.

```toml
name = "Human-readable name"

svg = """
<svg xmlns="http://www.w3.org/2000/svg" ...>...</svg>
"""

[screen]
svgElementId = "screen"
widthPx      = 320
heightPx     = 240
colorDisplay = true

[[buttons]]
svgElementId = "btn-vol-up"
buttonCode   = "VOL_UP"
friendlyName = "Volume Up"
```

SVG element IDs in `screen.svgElementId` and `buttons[].svgElementId` must match actual `id` attributes in the embedded SVG. `app-config.json` references layouts by path (e.g. `/layouts/default.toml`). The Vite dev server serves `layouts/` under `/layouts/` (with `text/plain; charset=utf-8` for `.toml` files); on build it is copied to `dist/layouts/` via the `layoutsPlugin` in `vite.config.ts`.

### Import aliases

Use `@` aliases for all cross-directory imports. Relative imports (`./`) are fine within the same directory.

| Alias | Resolves to |
|---|---|
| `@components/*` | `src/components/*` |
| `@layout/*` | `src/layout/*` |
| `@model/*` | `src/model/*` |
| `@serialization/*` | `src/serialization/*` |
| `@styles/*` | `src/styles/*` |

```ts
// Wrong — relative path crossing a directory boundary
import type { RemoteLayout } from '../layout/layout-types.ts';

// Correct — alias
import type { RemoteLayout } from '@layout/layout-types.ts';
```

## Branding in the configurator

See [../../agents.md](../../agents.md) for the full brand palette and wordmark specification. Here's how it maps to the configurator implementation:

### Theme

The Skeleton v4 theme is in `src/styles/theme-open-iris.css`. It defines the full OKLCH color palette for all Skeleton color roles (primary, secondary, tertiary, success, warning, error, surface) and sets typography and radius tokens.

- **Theme name:** `open-iris` — applied via `data-theme="open-iris"` on `<html>` in `index.html`
- **Primary:** Deep violet (light) / lighter violet (dark)
- **Secondary:** Mid violet (wordmark IR letters)
- **Tertiary:** Stamen gold (accents, IR emitter dot)
- **Surface:** Plum-tinted neutrals

### CSS styling approach

Use Tailwind utility classes and Skeleton presets for all styling. Priority:

1. **Tailwind utilities** — for layout, spacing, typography, colors using Skeleton color tokens (e.g. `text-primary-600-400`, `bg-surface-100-900`, `border-surface-200-800`)
2. **Skeleton presets** — `preset-filled-primary-500`, `preset-tonal`, `preset-outlined-error-500`, etc. for interactive elements
3. **Component `<style>` block** — only for pseudo-class rules (`:hover`, `:focus`), `:global()` overrides, and fixed pixel dimensions. Use `light-dark(var(--color-*-N), var(--color-*-N))` for dark-mode-aware values.

Never hardcode hex colors. Never use the old `--color-primary`, `--color-border`, `--color-surface` tokens (they no longer exist). Use Skeleton's OKLCH tokens: `--color-primary-600`, `--color-surface-200-800`, etc.

### Skeleton color pair notation

Skeleton uses color pairs for automatic light/dark adaptation:
- `bg-surface-50-950` → light: surface-50, dark: surface-950
- `bg-surface-100-900` → light: surface-100, dark: surface-900
- `border-surface-200-800` → light: surface-200, dark: surface-800
- `text-surface-500-400` → muted text (medium surface shade in both modes)
- `text-primary-600-400` → primary text with dark mode variant

In `<style>` blocks, use `light-dark()` for the same effect:
```css
background: light-dark(var(--color-surface-100), var(--color-surface-800));
border-color: light-dark(var(--color-surface-200), var(--color-surface-700));
```

### Wordmark

The branded `<header>` in App.svelte renders the wordmark as three `<span>` elements (`.wordmark-open`, `.wordmark-ir`, `.wordmark-is`) in a monospace font. Do not collapse these into a single element — the three-color rendering is part of the brand specification.

---

## Component philosophy

**Use Skeleton components for complex interactive patterns; native HTML with Tailwind for simple elements.**

### Skeleton headless components (from `@skeletonlabs/skeleton-svelte`)

Use these for interactive patterns that require accessible state management:

| Need | Skeleton component |
|---|---|
| Modal dialog | `<Dialog>` with `<Portal>`, `Dialog.Backdrop`, `Dialog.Positioner`, `Dialog.Content` |
| Toggle switch | `<Switch>` with `Switch.Control`, `Switch.Thumb`, `Switch.Label`, `Switch.HiddenInput` |
| Tab group | `<Tabs>` with `Tabs.List`, `Tabs.Trigger`, `Tabs.Content` |

All Skeleton components are headless — no default styles. You must apply Skeleton preset classes or Tailwind classes to style them.

### Native HTML elements with Tailwind (preferred for simple needs)

| Need | Approach |
|---|---|
| Button | `<button class="btn preset-filled-primary-500">` or `<button class="btn btn-sm hover:preset-tonal">` |
| Icon button | `<button class="btn-icon hover:preset-tonal">` |
| Text input | `<input class="input">` (styled by `@tailwindcss/forms` + Skeleton) |
| Number input | `<input class="input" type="number">` |
| Select / dropdown | `<select class="select">` |
| Input with unit suffix | `<div class="input-group"><input class="ig-input"><div class="ig-cell">unit</div></div>` |
| Labeled input | `<label class="label"><span class="label-text">Name</span><input class="input"></label>` |
| Badge / chip | `<span class="badge preset-tonal rounded-full">` or `<span class="badge preset-filled-primary-500 rounded-full">` |
| Divider | `<hr class="hr">` |
| Loading spinner | `<div class="size-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent">` |

### Icons (Lucide)

Import named icon components from `@lucide/svelte`. All icons use `class="size-4"` (or `size-3`, `size-5`, `size-8` as needed). Icon mapping:

| Bootstrap name (old) | Lucide component |
|---|---|
| `cpu` | `CpuIcon` |
| `upload` | `UploadIcon` |
| `download` | `DownloadIcon` |
| `plus-circle` | `PlusCircleIcon` |
| `pencil` | `PencilIcon` |
| `trash` | `Trash2Icon` |
| `chevron-left` | `ChevronLeftIcon` |
| `chevron-right` | `ChevronRightIcon` |
| `exclamation-octagon-fill` | `OctagonAlertIcon` |
| `exclamation-triangle-fill` | `TriangleAlertIcon` |
| `search` | `SearchIcon` |
| `grip-vertical` | `GripVerticalIcon` |
| `x` | `XIcon` |
| `check2` | `CheckIcon` |
| `collection-play` | `ListVideoIcon` |
| `list-ul` | `ListIcon` |
| `arrow-up` | `ArrowUpIcon` |
| `arrow-down` | `ArrowDownIcon` |
| `arrow-right` | `ArrowRightIcon` |
| `lightning-charge` | `ZapIcon` |

### Dialog pattern

All dialogs use Skeleton's controlled Dialog with Portal. The `open` prop controls visibility. `onOpenChange` is called when the user closes via Escape or backdrop click:

```svelte
<Dialog open={open} onOpenChange={(details) => { if (!details.open) onCancel(); }}>
    <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
            <Dialog.Content class="card bg-surface-100-900 w-full max-w-sm p-4 space-y-4 shadow-xl">
                <Dialog.Title class="text-base font-semibold">Title</Dialog.Title>
                <!-- content -->
                <footer class="flex justify-end gap-2">
                    <Dialog.CloseTrigger class="btn hover:preset-tonal">Cancel</Dialog.CloseTrigger>
                    <button class="btn preset-filled-primary-500" onclick={handleConfirm}>Save</button>
                </footer>
            </Dialog.Content>
        </Dialog.Positioner>
    </Portal>
</Dialog>
```

### Switch pattern

```svelte
<Switch checked={value} onCheckedChange={(details) => { value = details.checked; }}>
    <Switch.Control class="switch">
        <Switch.Thumb class="thumb" />
    </Switch.Control>
    <Switch.Label class="text-sm">Label text</Switch.Label>
    <Switch.HiddenInput />
</Switch>
```

---

## TypeScript rules

### No `any` or `unknown`

Never use `any` or `unknown`. Every value must have a concrete, named type. If a type is unclear, define an interface or class to make it explicit.

```ts
// Wrong
function parseConfig(data: any): any { ... }

// Correct
function parseConfig(data: ArrayBuffer): RemoteConfig { ... }
```

### Always use named interfaces or classes — no inline types

Define a named `interface` or `class` for every object shape. Do not use inline object type literals as parameter types, return types, or variable annotations.

### No inline import expressions in type positions

Never use `import('…').TypeName` inline in a type position. Always add the type to the top-level `import` block instead.

```ts
// Wrong
function serialize(state: import('@model/state.ts').State): Uint8Array { ... }

// Correct
import type { State } from '@model/state.ts';
function serialize(state: State): Uint8Array { ... }
```

```ts
// Wrong
function createButton(descriptor: { svgElementId: string; buttonCode: ButtonCode }): void { ... }

// Correct
interface ButtonCreationOptions {
    svgElementId: string;
    buttonCode: ButtonCode;
}

function createButton(options: ButtonCreationOptions): void { ... }
```

This also applies to intermediate results, state shapes, and event payloads — anything complex enough to have more than one field gets its own named interface.

### Naming

- **Interfaces and classes:** `PascalCase` — `RemoteLayout`, `ButtonDescriptor`, `ConfigReader`
- **Variables, parameters, functions:** `camelCase`, never abbreviated — `buttonCode` not `btnCd`, `contextIndex` not `ctxIdx`, `remainingByteCount` not `n`
- **Constants:** `SCREAMING_SNAKE_CASE` for true compile-time constants; `camelCase` for module-level values that happen to be constant

## Svelte conventions

- Prefer Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) over Svelte 4 reactive syntax.
- Keep components focused — if a component is doing multiple unrelated things, split it.
- Define prop types as a named interface passed to `$props<PropsInterface>()`.
- Dispatch custom events with typed `CustomEvent<T>` payloads; define the payload type as a named interface.

## Code style

- **Braces:** Always use braces for `if`, `else`, `for`, `while`, and `do` blocks, even for single-statement bodies.
- **Block bodies on their own lines:** The opening `{` goes on the same line as the statement; the body and closing `}` are each on their own line. Never put the body on the same line as the braces (`if (x) { return; }` is wrong; expand it).
- **Blank lines around blocks:** Put a blank line before and after every `if`/`for`/`while` block (and any other multi-line statement) unless it is the very first or last thing in its enclosing block.
- **Function bodies:** Named functions always use the multi-line form — opening `{` on the signature line, body indented, closing `}` on its own line. One-liner named functions (`function foo() { bar(); }`) are not allowed.
- **Line length:** No limit. Do not wrap at 80 or 120 characters.
- **Indentation:** 4 spaces, no tabs.
- **Quotes:** Single quotes for string literals in TypeScript; double quotes in Svelte template attributes.
- **Trailing commas:** Use trailing commas in multi-line arrays, objects, and parameter lists.
- **Semicolons:** Required.

## Formatting

Prettier is configured via `.prettierrc` at this directory level. Run `npm run format` to auto-format. The configuration enforces printWidth of 200 (effectively no wrapping), 4-space indentation, single quotes, and semicolons.

## Comments

Only write a comment when the **why** is non-obvious — a subtle serialization invariant, a Svelte lifecycle quirk, or a workaround for a specific browser or Skeleton behavior. Do not describe what the code does if well-named identifiers already say it.
