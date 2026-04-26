# OpenIRis — Brand & Visual Identity

## Name

**OpenIRis**

An open-source universal remote control, conceived as a free, dependency-free alternative to the Logitech Harmony. No external accounts, no internet required.

The name layers three meanings:
- **Open** — open-source hardware and software
- **IR** — infrared, the underlying signal technology
- **Iris** — the iris of an eye (aperture, focus, control) and the iris flower (the color palette)

The `IR` within the name should be visually distinguished wherever possible — in the wordmark it appears in a lighter violet, making the abbreviation readable without being heavy-handed.

---

## Logo

The mark is an **iris/aperture symbol**: a solid circular pupil surrounded by a ring, with eight tick marks at the cardinal and diagonal positions. A small gold dot sits at the center of the pupil, representing the IR emitter — a single focused point of light.

### Mark anatomy

```
        |
   \    |    /
    \   |   /
─────( ● )─────
    /   |   \
   /    |    \
        |
```

- Outer ring — primary brand color, 3px stroke
- Pupil — solid fill, primary brand color, radius ~37% of outer ring
- Eight tick marks — cardinal marks in primary color, diagonal marks in secondary (lighter) violet
- Center dot — gold accent, radius ~10% of outer ring

### Sizing guidance

The mark is designed to scale cleanly. At small sizes (favicon, 16–32px) the tick marks can be dropped and the mark reads as a simple ringed circle with a center dot. At medium sizes (app icon, 64px+) the full mark should be used.

---

## Color Palette

Derived from the iris flower: deep violet petals, lighter violet inner markings, and a warm gold stamen.

### Light mode

| Role | Name | Hex |
|---|---|---|
| Primary | Deep violet | `#5c3d8f` |
| Secondary | Mid violet | `#7b52b8` |
| Accent | Stamen gold | `#c9a833` |
| Text primary | Near black | `#2d1a4a` |
| Text secondary | Muted violet | `#9488aa` |
| Background | Soft lavender | `#f5f2ff` |
| Surface | White | `#ffffff` |

### Dark mode

| Role | Name | Hex |
|---|---|---|
| Primary | Light violet | `#a07ee0` |
| Secondary | Pale violet | `#c4a8f0` |
| Accent | Bright gold | `#e8c14a` |
| Text primary | Near white | `#ede8ff` |
| Text secondary | Muted violet | `#7060a0` |
| Background | Deep plum | `#1a1520` |
| Surface | Dark plum | `#231b2e` |

### CSS custom properties

```css
:root {
  --color-primary:          #5c3d8f;
  --color-secondary:        #7b52b8;
  --color-accent:           #c9a833;
  --color-text-primary:     #2d1a4a;
  --color-text-secondary:   #9488aa;
  --color-background:       #f5f2ff;
  --color-surface:          #ffffff;
  --color-border:           rgba(92, 61, 143, 0.2);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-primary:          #a07ee0;
    --color-secondary:        #c4a8f0;
    --color-accent:           #e8c14a;
    --color-text-primary:     #ede8ff;
    --color-text-secondary:   #7060a0;
    --color-background:       #1a1520;
    --color-surface:          #231b2e;
    --color-border:           rgba(160, 126, 224, 0.2);
  }
}
```

---

## Typography

The wordmark uses a **monospace** font, reinforcing the technical, firmware-level nature of the project. UI prose uses a clean sans-serif.

| Context | Font | Weight |
|---|---|---|
| Wordmark | Monospace | 500 |
| Subheading / tagline | Monospace | 400 |
| UI body | Sans-serif | 400 |
| UI labels | Sans-serif | 500 |

### Wordmark rendering

```
Open  →  --color-text-primary   (near black / near white)
IR    →  --color-secondary      (lighter violet)
is    →  --color-primary        (main violet)
```

The tagline, where used, reads:

```
OPEN SOURCE UNIVERSAL REMOTE
```

Set in monospace, uppercase, ~10–11px, letter-spacing 0.18em, in `--color-text-secondary`.

---

## Voice & Positioning

- **Free as in freedom.** No accounts, no cloud, no subscriptions.
- **Offline first.** The configuration tool runs in a browser but can be hosted on the device itself.
- **Hardware agnostic.** Built on ESP32/ESP-IDF; the format and protocol are open.
- **No lock-in.** Configuration is stored in an open binary format, not a proprietary service.

The tone is direct and technical without being unfriendly. Documentation should read like it was written by a developer for developers — precise, honest, no marketing fluff.

---

## Project context

| | |
|---|---|
| Hardware platform | ESP32 / ESP-IDF |
| Firmware language | C |
| Configuration UI | Browser-based (hostable on-device) |
| License | Open source (TBD) |
| Repository | TBD |
