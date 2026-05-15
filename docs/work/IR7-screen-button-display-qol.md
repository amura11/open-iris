# Screen Button Display & QoL

**Goal:** Render screen buttons visually on the device screen in the remote preview, and add quality-of-life improvements to the screen button list — primarily reordering.

Depends on IR5 (button assignment UI and `ScreenButtonConfig` model).

---

## Background

Screen buttons currently exist only as a list in the inspector panel (via `ScreenButtonList` / `ScreenButtonRow`). The remote preview shows the physical remote SVG with clickable physical buttons, but clicking the screen area only opens the screen inspector — the buttons themselves have no visual presence in the preview canvas.

---

## Terminology

| Term | Definition |
|---|---|
| **Screen overlay** | The rendered set of screen buttons placed inside the screen area of the remote SVG. |
| **Screen area** | The bounding rectangle of the SVG element identified by `layout.screen.svgElementId`. |
| **Screen button** | A `ScreenButtonConfig` entry — has a stable numeric `id`, a `label`, and an optional `sequenceId`. |

---

## Screen Button Display (Remote Preview)

### Overlay approach

The screen overlay is always visible, giving a live preview of the current state's screen configuration as the user works. When the screen or a screen button is not selected, the overlay renders at reduced opacity so it doesn't compete with the physical button UI.

The overlay is a regular HTML `<div>` absolutely positioned to match the screen SVG element's bounding rect in viewport coordinates. It is placed inside the `.transform-layer` so it scales and pans with the rest of the remote, or it can be placed outside as a HUD-style layer that tracks the screen rect via a `getBoundingClientRect` + scroll-adjusted calculation.

### Button layout

Buttons are stacked vertically inside the overlay, filling the screen area. Each button occupies equal height (flex column, `flex: 1`). Label is centered horizontally and vertically. No icon support in this iteration.

Buttons respect the order of `state.screenButtons` — the array order is the display order.

### Selection

Clicking a screen button in the overlay:
- Sets `selection` to `{ type: 'screen-button', buttonId: number }` (new selection variant — see model changes below).
- Zooms the preview to the screen area (same behavior as clicking the screen SVG element today).
- Highlights the selected button row in the inspector panel and scrolls it into view.

The inspector is the canonical place for assignment; clicking an overlay button does not auto-expand the assignment panel.

### Empty state

When `state.screenButtons` is empty, the screen area shows a faint "No buttons" placeholder so the user understands the screen is configurable.

---

## Selection Model Change

Add a new selection variant to `Selection` (in `@model/selection.ts`):

```ts
export type Selection =
    | null
    | { type: 'button';        buttonCode: string }
    | { type: 'screen' }
    | { type: 'screen-button'; buttonId: number };
```

When `selection.type === 'screen-button'`, the inspector shows the `ScreenInspector` (same as `'screen'`) and the matching `ScreenButtonRow` is visually highlighted / auto-scrolled into view.

---

## Reordering: Shared DnD Pattern

Both screen button reordering (`ScreenButtonList`) and sequence step reordering (`SequenceEditorDialog`) use the same drag-and-drop approach. The sequence editor currently uses up/down arrow buttons — this ticket replaces those with DnD to keep the two surfaces consistent.

### Interaction

Each draggable row gets a grab-handle icon on the left (`grip-vertical` or equivalent). The user drags a row to a new position; on drop the array is reordered and the parent is notified.

### Implementation approach

Use the native HTML Drag and Drop API (no extra library). The drag handle element has `draggable="true"`. On `dragstart`, store the index of the dragged item. On `dragenter`/`dragover`, show a drop-indicator line between rows. On `drop`, swap the array order and call the appropriate update callback.

The same logic applies in both `ScreenButtonList` (calls `onUpdate` with the reordered `State`) and `SequenceEditorDialog` (mutates the local `steps` array).

---

## QoL: Assignment Status Indicators on Overlay Buttons

Each button in the screen overlay shows a subtle visual indicator of its assignment status:

- **Unassigned** — muted / dimmed appearance.
- **Assigned** — normal appearance; no label suffix needed (the label already describes the button, not the action).

This gives a quick at-a-glance read of how much of the screen is configured.

---

## Model Changes Summary

| Change | Location |
|---|---|
| Add `screen-button` variant to `Selection` | `@model/selection.ts` |
| No changes to `ScreenButtonConfig` or `State` | — |

---

## Component Changes Summary

| Component | Change |
|---|---|
| `RemotePreview.svelte` | Add always-visible screen overlay; dim when screen/screen-button is not selected |
| `InspectorPanel.svelte` | Route `screen-button` selection to `ScreenInspector`; treat it as `'screen'` for panel routing |
| `ScreenInspector.svelte` | Accept and forward highlighted `buttonId` from selection |
| `ScreenButtonList.svelte` | Add DnD reorder; highlight selected row; scroll-to-highlighted |
| `ScreenButtonRow.svelte` | Add drag handle; accept `highlighted` prop for visual emphasis |
| `SequenceEditorDialog.svelte` | Replace up/down arrow buttons with DnD grab handles on step rows |
