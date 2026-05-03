# Configurator — Agent Guidance

Browser-based configuration UI for OpenIRis. See [../../agents.md](../../agents.md) for project-wide standards that also apply here.

## Tech stack

- **Language:** TypeScript (strict mode)
- **UI framework:** Svelte 5
- **Component library:** Shoelace (`@shoelace-style/shoelace`)
- **Build tool:** Vite 6

## Project structure

```
src/
  App.svelte              Root component
  main.ts                 Entry point
  app-config.ts           Runtime app configuration type
  components/             Svelte UI components  (@components alias)
  layout/                 Layout descriptor loading and types  (@layout alias)
  model/                  Domain model types (button codes, contexts, etc.)  (@model alias)
  serialization/          Binary .iris format reader and writer  (@serialization alias)
  styles/                 CSS — theme.css, global.css, utils.css  (@styles alias)
public/
  app-config.json         Runtime config loaded at startup
layouts/
  <id>.json               Layout descriptor — one file per hardware variant (SVG embedded)
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

### Theme files

| File | Purpose |
|------|---------|
| [src/styles/theme.css](src/styles/theme.css) | Brand CSS custom properties + Shoelace primary/neutral color scale overrides, light and dark |
| [src/styles/global.css](src/styles/global.css) | Body font, background, color, typography base, scrollbar |
| [src/styles/utils.css](src/styles/utils.css) | Utility classes (see [CSS styling](#css-styling) section) |

Both are imported in `main.ts` after the Shoelace base theme.

### CSS custom properties

Use `--color-*` tokens (defined in theme.css) for all colors in components. Never hardcode hex colors. The full set:

```
--color-primary          deep violet (main brand color)
--color-secondary        mid violet
--color-accent           stamen gold
--color-text-primary     near black / near white
--color-text-secondary   muted violet
--color-background       dark near-black (dark) / soft lavender (light)
--color-surface          semi-transparent surface (rgba — the "glass" base)
--color-border           vivid violet with alpha (the "neon" edge)
--color-glow             rgba spread color for box-shadow glows
--font-sans              system sans-serif stack
--font-mono              system monospace stack
```

Glass token:

```
--surface-glass          backdrop-filter blur value — use with the .glass utility class
```

### Shoelace theming

Shoelace component tokens (`--sl-color-primary-*`, `--sl-font-sans`, etc.) are overridden in theme.css to match the violet brand palette. When using Shoelace components (`<sl-button>`, `<sl-input>`, etc.) they will automatically pick up brand colors. The `setBasePath` call in main.ts is required for Shoelace icon assets to resolve correctly.

### Wordmark

The branded `<header>` in App.svelte renders the wordmark as three `<span>` elements (`.wordmark-open`, `.wordmark-ir`, `.wordmark-is`) in a monospace font. Do not collapse these into a single element — the three-color rendering is part of the brand specification.

---

## Component philosophy

**Use Shoelace components as the primary building blocks.** Before writing any custom UI, check whether Shoelace already provides it. The rule is: if Shoelace has it, use it — do not reimplement it with native elements or custom CSS.

### Use Shoelace directly for

| Need | Shoelace component |
|---|---|
| Button, icon button, link button | `<sl-button>` |
| Text input, number input, password | `<sl-input>` |
| Multiline text | `<sl-textarea>` |
| Dropdown select | `<sl-select>` + `<sl-option>` |
| Checkbox, radio, switch | `<sl-checkbox>`, `<sl-radio-group>`, `<sl-switch>` |
| Modal dialog | `<sl-dialog>` |
| Side drawer | `<sl-drawer>` |
| Card / surface | `<sl-card>` |
| Tabs | `<sl-tab-group>`, `<sl-tab>`, `<sl-tab-panel>` |
| Tooltip | `<sl-tooltip>` |
| Alert / toast | `<sl-alert>` |
| Badge | `<sl-badge>` |
| Tag / chip | `<sl-tag>` |
| Icon | `<sl-icon>` |
| Loading spinner | `<sl-spinner>` |
| Skeleton loader | `<sl-skeleton>` |
| Divider | `<sl-divider>` |
| Progress bar | `<sl-progress-bar>` |
| Dropdown menu | `<sl-dropdown>`, `<sl-menu>`, `<sl-menu-item>` |
| Tree view | `<sl-tree>`, `<sl-tree-item>` |

### When to create a custom Svelte component

A custom Svelte component is appropriate when it:
- **Wraps a Shoelace component with app-specific behavior** — e.g. a `<MetricCard>` built on `<sl-card>` that knows how to render a label/value pair, or a `<ConfirmDialog>` built on `<sl-dialog>` with the project's standard button layout.
- **Composes multiple Shoelace components** into a reusable unit for a domain concept — e.g. a button-code picker that combines `<sl-select>` with a preview.
- **Is genuinely app-specific** — layout that has no Shoelace analogue, like the remote preview canvas.

Never build a custom alternative to a component Shoelace already provides. If a Shoelace component needs visual tweaking, use CSS custom properties (`--sl-*`) or the `::part()` pseudo-element, not a native element replacement.

---

## CSS styling

All styling must follow this priority ladder, from highest to lowest preference:

1. **Utility classes** from `src/styles/utils.css` — use these for the vast majority of layout, spacing, typography, color, and display needs.
2. **Design token variables** (`var(--sl-*)`, `var(--color-*)`) in a component `<style>` block — when a utility class doesn't exist for the property, or when a value needs component-specific context (e.g. a hover rule, a `:global()` override, a unique layout dimension).
3. **Hard-coded values** — only for genuinely exceptional cases where no token exists and no utility applies (e.g. a fixed pixel dimension for a brand asset like the 32px mark icon). Must be a rare exception, not the default.

Never hard-code hex colors. If you need a semantic state color (danger, success, warning), use the Shoelace semantic tokens (`--sl-color-danger-*`, `--sl-color-success-*`, `--sl-color-warning-*`).

### Utility class reference

The full suite is defined in [src/styles/utils.css](src/styles/utils.css). Key categories:

| Category | Classes | Scale / values |
|---|---|---|
| Padding | `p-*`, `px-*`, `py-*`, `pt-*`, `pr-*`, `pb-*`, `pl-*` | `0 3xs 2xs xs s m l xl 2xl 3xl 4xl` |
| Margin | `m-*`, `mx-*`, `my-*`, `mt-*`, `mr-*`, `mb-*`, `ml-*` | same scale + `auto` |
| Gap | `gap-*`, `gap-x-*`, `gap-y-*` | same scale |
| Font size | `text-2xs` … `text-4xl` | maps to `--sl-font-size-*` |
| Font weight | `font-light`, `font-normal`, `font-semibold`, `font-bold` | |
| Font family | `font-sans`, `font-mono` | |
| Line height | `lh-denser`, `lh-dense`, `lh-normal`, `lh-loose`, `lh-looser` | |
| Letter spacing | `tracking-denser` … `tracking-looser` | |
| Text color | `text-primary`, `text-secondary`, `text-accent`, `text-body`, `text-muted`, `text-danger`, `text-success`, `text-warning` | |
| Background | `bg-background`, `bg-surface`, `bg-primary`, `bg-danger`, `bg-success`, `bg-warning`, `bg-transparent` | |
| Border | `border`, `border-top`, `border-right`, `border-bottom`, `border-left`, `border-none` | |
| Border radius | `rounded-none`, `rounded-s`, `rounded-m`, `rounded-l`, `rounded-xl`, `rounded-2xl`, `rounded-circle`, `rounded-pill` | |
| Display | `d-block`, `d-inline`, `d-inline-block`, `d-flex`, `d-inline-flex`, `d-grid`, `d-contents`, `d-none` | |
| Flex | `flex-row`, `flex-col`, `flex-wrap`, `flex-nowrap`, `flex-1`, `flex-auto`, `flex-none`, `shrink-0`, `grow` | |
| Align/justify | `items-*`, `justify-*`, `self-*` | `start center end stretch (baseline)` |
| Text utils | `text-left`, `text-center`, `text-right`, `uppercase`, `lowercase`, `capitalize`, `underline`, `no-underline`, `truncate` | |
| Sizing | `w-full`, `w-auto`, `h-full`, `h-auto`, `min-h-screen`, `min-w-0`, `min-h-0` | |
| Position | `relative`, `absolute`, `fixed`, `sticky` | |
| Overflow | `overflow-hidden`, `overflow-auto`, `overflow-scroll`, `overflow-x-hidden`, `overflow-y-auto` | |
| Misc | `cursor-pointer`, `cursor-default`, `pointer-events-none`, `select-none` | |

### When a component `<style>` block is appropriate

- **Hover / focus / active rules** — pseudo-class selectors cannot be expressed as utility classes.
- **`:global()` overrides** — targeting SVG child elements or Shoelace internals.
- **Unique layout dimensions** — fixed pixel sizes for brand assets (e.g. `width: 32px` for the mark icon) that have no matching token.
- **Semantic component colors** not in the utility set — use token variables directly, never hex values.

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

Only write a comment when the **why** is non-obvious — a subtle serialization invariant, a Svelte lifecycle quirk, or a workaround for a specific browser or Shoelace behavior. Do not describe what the code does if well-named identifiers already say it.
