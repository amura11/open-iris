# Configurator

The configurator is a Svelte 5 web application that lets users build a remote config visually and export it as `remote.bin` for the device.

## Status

| Feature | State |
|---|---|
| Layout loading (TOML + embedded SVG) | Built |
| SVG remote preview with click interactions | Built |
| State/Item editing via InspectorPanel | Built |
| State selector (switch between states) | Built |
| Export `remote.bin` | Built |
| Import `remote.bin` | Built |
| Button action assignment | Deferred |
| Layout switcher UI | Deferred |

## Tech Stack

- **Framework:** Svelte 5 (runes mode — `$state`, `$derived`, `$props`)
- **Language:** TypeScript (strict)
- **Components:** Shoelace
- **Build:** Vite 6
- **TOML parser:** smol-toml

## File Structure

```
source/configurator/src/
  App.svelte                Root component — owns layout, config, selectedStateId, selection, and panel state
  main.ts                   Entry point — loads Shoelace, sets base path, mounts app
  app-config.ts             AppConfig + LayoutRef types; loadAppConfig() fetches /app-config.json
  components/               (@components alias)
    RemotePreview.svelte    Inlines SVG; wires screen + button click handlers; applies CSS state classes
    InspectorPanel.svelte   Collapsible right panel; renders ScreenInspector or ButtonInspector
    ScreenInspector.svelte  State type badge + buttonFallback toggle + ItemList for the selected state
    ButtonInspector.svelte  Shows button code; action assignment placeholder
    ItemList.svelte         CRUD list of Items within a State
    ItemEditor.svelte       Single-item inline editor (label input + save/cancel)
  layout/                   (@layout alias)
    layout-types.ts         ScreenDescriptor, ButtonDescriptor, RemoteLayout interfaces
    layout-loader.ts        loadLayout(path) — fetches .toml, parses with smol-toml → RemoteLayout
  model/                    (@model alias)
    state.ts                Item, State, StateType, RemoteConfig types
    button-codes.ts         ButtonCode enum — manually synced with firmware button_codes.h
    selection.ts            Selection union type
  serialization/            (@serialization alias)
    writer.ts               RemoteConfig → Uint8Array; downloadBin() triggers remote.bin download
    reader.ts               Uint8Array → RemoteConfig via deserialize()
  styles/                   (@styles alias)
    theme.css               Brand tokens + Shoelace overrides
    global.css              Body, background, base typography
    utils.css               Utility classes
```

## Layout File Format

Each hardware variant is a single `.toml` file in `source/configurator/layouts/`. The SVG skin is embedded inline as a TOML multiline string — no separate `.svg` file.

```toml
name = "Default Remote"

svg = """
<svg ...>
  <rect id="screen" .../>
  <circle id="btn-vol-up" .../>
</svg>
"""

[screen]
svgElementId = "screen"
widthPx      = 320
heightPx     = 480
colorDisplay = true

[[buttons]]
svgElementId = "btn-vol-up"
buttonCode   = "VOL_UP"
friendlyName = "Volume Up"
```

The `svgElementId` values in `[screen]` and `[[buttons]]` must match `id` attributes in the embedded SVG — that is the entire contract between the two halves. The Vite `layoutsPlugin` serves `layouts/` under `/layouts/` in dev and copies it to `dist/layouts/` on build.

`app-config.json` lists available layouts and which is default:

```json
{
  "defaultLayout": "default",
  "layouts": [
    { "id": "default", "name": "Default Remote", "path": "/layouts/default.toml" }
  ]
}
```

## UI Architecture

The app uses a state selector bar + two-panel layout.

### State Selector Bar

A centered `sl-select` dropdown between the header and the canvas split. Populated from `remoteConfig.states`. Changing the selection updates `selectedStateId` in `App.svelte`, which drives `selectedState` (a `$derived`) that flows into `InspectorPanel` as the `activeState` prop. On import, `selectedStateId` resets to the new config's `rootStateId`.

### RemotePreview (left)

Fills available canvas space. Inlines the SVG so elements are real DOM nodes. On mount it queries each `svgElementId` from the layout, attaches click listeners to screen and button elements, and applies CSS state classes (`.button--assigned`, `.button--unassigned`, `.screen--editing`). Fires `onScreenClick` / `onButtonClick` upward. Owns no editing state.

### InspectorPanel (right)

Collapsible right panel; width is resizable by dragging the separator. Receives `activeState` as a prop (already resolved by `App.svelte` from `selectedStateId`). Shows `ScreenInspector` when the screen is selected, `ButtonInspector` when a button is selected, or a placeholder when nothing is selected. Fires `onStateUpdate` upward when items are edited. Title updates reactively based on the current selection.

### Selection Model

`App.svelte` owns a `Selection` value and is the only writer. Both panels receive it as a prop.

```typescript
// model/selection.ts
export type Selection =
    | { type: 'screen' }
    | { type: 'button'; buttonCode: string }
    | null;
```

## Serialization

**Export (`writer.ts`):** `serialize(config)` builds the binary in a single pass — string blob first, then item records, then state records (variable length due to inline item ID lists), then the manifest with computed absolute offsets, then the header. `downloadBin(config)` calls `serialize` and triggers a browser download.

**Import (`reader.ts`):** `deserialize(bytes)` validates magic + version (rejects v0x01), reads the manifest to locate each block, parses State and Item records, resolves string offsets into JS strings, and returns a `RemoteConfig`. Import errors are shown as a dismissable toast in the UI.

## Deferred

- Button action assignment (ButtonInspector shows the button code; assignment not yet implemented)
- Layout switcher UI (app-config.json supports multiple layouts; picker not built)
