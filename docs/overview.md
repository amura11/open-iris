# OpenIRis — Overview

OpenIRis is an open-source universal remote control built on the ESP32, configured through a browser-based Svelte app; all data lives on the device in an open binary format with no cloud dependency.

## Status

| Area | State |
|---|---|
| Dev container | Built |
| Configurator: layout loading + SVG preview | Built |
| Configurator: State/Item editing | Built |
| Configurator: export `remote.bin` | Built |
| Configurator: import `remote.bin` | Built |
| Configurator: button action assignment | Deferred |
| Firmware: binary config reader | Planned |
| Firmware: LVGL display rendering | Planned |
| Firmware: button input handling | Deferred |

## Terminology

| Term | Definition |
|---|---|
| **State** | The core UI building block. Every screen the remote can show is a State. |
| **State Type** | One of three values: **Root** (home screen, always present), **Persistent** (a durable activity — only one active at a time), or **Ephemeral** (a transient overlay that does not change the active state). |
| **Item** | A single entry within a State — currently just a display string. Later: navigation targets, command triggers. |
| **Remote Layout** | A `.toml` file pairing an embedded SVG skin with descriptors for the remote's screen and buttons. Independent of the logical config. |
| **Button Code** | A named string constant (e.g. `VOL_UP`) identifying a physical button. Defined in both the firmware (`button_codes.h`) and the configurator (`button-codes.ts`), kept in sync manually. |
| **`remote.bin`** | The binary config file written by the configurator and read by the firmware. |

## Repository Structure

```
openiris/
├── .devcontainer/
│   ├── devcontainer.json
│   ├── Dockerfile
│   └── scripts.sh
├── brand/                  Logo assets and brand guide
├── docs/                   Spec documents
├── source/
│   ├── configurator/       Svelte 5 + TypeScript web app (Vite 6)
│   │   ├── layouts/        Remote layout descriptors (.toml files)
│   │   ├── public/         Static assets (app-config.json, favicon)
│   │   └── src/            Application source
│   └── firmware/           ESP-IDF project for the ESP32
│       └── components/
│           ├── config/     Binary config loader
│           ├── display/    LVGL + ILI9341 SPI driver
│           └── ui/         LVGL widget construction from config data
└── temp/                   Scratch documents — not authoritative
```

## Dev Container

A single devcontainer provides a reproducible environment for both the firmware and configurator.

- **Base image:** `espressif/idf:v5.3` — IDF 5.x, xtensa/RISC-V toolchains, all build deps pre-installed
- **Node.js:** Added via the `ghcr.io/devcontainers/features/node:1` feature (LTS)
- **`IDF_PATH`:** set to `/opt/esp/idf` — picked up automatically by the ESP-IDF VS Code extension
- Both `idf.py build` and `npm run dev` work immediately inside the container

## End-to-End Data Flow

```
app-config.json
  → loadAppConfig()         reads defaultLayout id + available layout paths
  → loadLayout(path)        fetches .toml, parses with smol-toml → RemoteLayout
  → RemotePreview           inlines SVG, wires click interactions
  → InspectorPanel          ScreenInspector / ButtonInspector based on selection
  → RemoteConfig (memory)
  → writer.ts               serializes to Uint8Array → remote.bin download
  → [SD card → firmware]
  → config_load()           parses remote.bin → config_t in-memory tree
  → ui_render_context()     renders item labels on ILI9341 via LVGL
```

## Deferred

- Button action assignment (dialog shows button code; assignment not yet implemented)
- Button input handling in firmware (ISRs, debouncing, button-to-action mapping)
- State activation logic (one-at-a-time Persistent state constraint)
- Navigation stack runtime implementation
- Command sequences (IR codes, macros)
- `onActivate` / `onDeactivate` execution
- Layout switcher UI (app-config.json supports multiple layouts; picker not built)
- LVGL themes beyond default
- Serving the configurator from the device itself
- Button code enum consolidation (C and TS enums are manually synced)
