# OpenIRis — Agent Guidance

OpenIRis is an open-source universal remote control built on the ESP32 microcontroller. It is a self-contained, offline alternative to the Logitech Harmony line. Configuration is done through a browser-based UI; all data lives on the device in an open binary format.

## Repository layout

```
source/
  firmware/        ESP-IDF C firmware for the ESP32 (see source/firmware/agents.md)
  configurator/    Browser-based config UI — Svelte 5 + TypeScript (see source/configurator/agents.md)
    layouts/       Layout descriptor files (single JSON per hardware variant, SVG embedded)
```

## General coding standards

These apply to all code in this repository regardless of language.

### Naming

- **Never abbreviate variable, parameter, or field names.** Characters are free — use them. `buttonCode` not `btnCd`, `contextIndex` not `ctxIdx`, `remainingByteCount` not `remBytes`.
- Names should communicate intent clearly. Prefer clarity over compactness.

### Control flow

- **Always use braces for `if`, `else`, `for`, `while`, and `do` blocks**, even for single-statement bodies. This applies in both C and TypeScript/Svelte.

```c
// Wrong
if (!config) return;

// Correct
if (!config) {
    return;
}
```

```ts
// Wrong
if (error) throw error;

// Correct
if (error) {
    throw error;
}
```

### Line length

- There is no enforced line length limit. Do not wrap lines at 80 or 120 characters. Let lines be as long as they need to be for readability.

## Brand & visual identity

The full brand guide lives at [brand/brand-guide.md](brand/brand-guide.md). Key points for anyone touching the UI or documentation:

### Name

**OpenIRis** — always spelled exactly this way. The `IR` is the meaningful abbreviation; `is` completes "iris". The name has three layers: Open (open-source), IR (infrared), Iris (the eye/flower palette).

### Wordmark rendering

The wordmark must always render the name in three visually distinct segments, using a monospace font:

| Segment | Color (light) | Color (dark) |
|---------|--------------|--------------|
| `Open`  | `#2d1a4a` (text-primary) | `#ede8ff` |
| `IR`    | `#5c3d8f` (primary)      | `#a07ee0` |
| `is`    | `#7b52b8` (secondary)    | `#c4a8f0` |

The tagline, when shown, reads **OPEN SOURCE UNIVERSAL REMOTE** — uppercase, monospace, `--sl-font-size-2x-small` (~10px), `--sl-letter-spacing-looser` tracking, in `--color-text-secondary`.

### Color palette

| Token | Light mode | Dark mode |
|-------|-----------|-----------|
| `--color-primary` | `#5c3d8f` deep violet | `#a07ee0` light violet |
| `--color-secondary` | `#7b52b8` mid violet | `#c4a8f0` pale violet |
| `--color-accent` | `#c9a833` stamen gold | `#e8c14a` bright gold |
| `--color-text-primary` | `#2d1a4a` near black | `#ede8ff` near white |
| `--color-text-secondary` | `#9488aa` muted violet | `#7060a0` muted violet |
| `--color-background` | `#f5f2ff` soft lavender | `#1a1520` deep plum |
| `--color-surface` | `#ffffff` white | `#231b2e` dark plum |
| `--color-border` | `rgba(92,61,143,0.2)` | `rgba(160,126,224,0.2)` |

### Logo mark

The mark is an iris/aperture symbol: outer ring + pupil + eight tick marks + gold center dot. Cardinal ticks use the primary color; diagonal ticks use the secondary color. The gold center dot represents the IR emitter.

- Full-featured mark: [brand/openiris-mark.svg](brand/openiris-mark.svg)
- Reference (light + dark panels): [brand/openiris-logo-reference.svg](brand/openiris-logo-reference.svg)
- Simplified favicon (ring + pupil + dot only): [source/configurator/public/favicon.svg](source/configurator/public/favicon.svg)

### Typography

- **Wordmark / tagline / monospace UI:** `ui-monospace, 'Cascadia Code', 'JetBrains Mono', Menlo, Consolas, monospace`
- **UI body / labels:** `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

No Google Fonts dependency — the project is offline-first.

### Voice

Direct and technical without being unfriendly. No marketing fluff. No cloud, no accounts, no subscriptions messaging is always accurate and always present.

---

## Language-specific standards

See the subproject `agents.md` files for language-specific rules:

- **C / ESP-IDF firmware:** [source/firmware/agents.md](source/firmware/agents.md)
- **TypeScript / Svelte configurator:** [source/configurator/agents.md](source/configurator/agents.md)
