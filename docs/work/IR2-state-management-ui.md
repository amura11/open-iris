# State Management UI

Add the ability to create new states and edit the properties of existing ones. Currently the configurator ships with a hardcoded single Root state and no way to build out a config from scratch. This spec covers the creation/deletion workflow and the editable properties of a state.

---

## Scope

**In scope:**
- Adding new states (Persistent or Ephemeral)
- Deleting existing states (non-Root only)
- Editing a state's name (all types)
- Editing a state's type (Persistent ↔ Ephemeral; Root is locked)
- Button fallback toggle on Persistent and Ephemeral states
- Macro stubs (onActivate / onDeactivate) on Persistent states
- RemotePreview: remove horizontal panning, clamp zoom, always keep remote horizontally centered

**Out of scope:**
- Reordering states

---

## Inspector Panel Layout

The inspector panel gains a persistent top section for state-level settings, with the existing selection-driven content (items list, button config) below it. The two sections are separated by a divider.

```
┌─────────────────────────────────┐
│  State Settings                 │  ← always visible
│  (name, type, macros)           │
├─────────────────────────────────┤
│  Screen / Button Config         │  ← driven by click selection
│  (ItemList or ButtonInspector)  │
└─────────────────────────────────┘
```

The panel header always shows "Properties".

### State Settings section

Always present regardless of selection. The section is collapsible — a chevron toggle in the section header expands and collapses it. Defaults to open. Switching between states preserves whatever the user last set.

When **Add** creates a new state the section is forced open (even if the user had collapsed it) so the name input is immediately visible and focused.

**Layout (vertical stack):**

```
[ name input ]
[ type switch/badge ]
[ buttonFallback switch ]    ← Persistent and Ephemeral only
[ onActivate stub row ]      ← Persistent only
[ onDeactivate stub row ]    ← Persistent only
```

**Name input:** `<sl-input>` full width. Always editable including Root. Live update via `onsl-input`.

**Type control:**

| State type | Control |
|---|---|
| Root | `sl-badge variant="neutral"` pill — read-only |
| Persistent or Ephemeral | `<sl-switch>` labeled "Ephemeral" (unchecked = Persistent, checked = Ephemeral) |

The switch emits `onsl-change`; call `onUpdate` with the new `stateType`. `buttonFallback` is preserved across type changes.

**Button fallback:** `<sl-switch>` shown on Persistent and Ephemeral states (hidden on Root). Preserved when switching between Persistent and Ephemeral.

**Macro stubs (Persistent only):** Each is a labeled row with a muted "Not configured" hint and a disabled Edit icon button. Signals to the user that the field exists and will be configurable later.

```
On activate    — Not configured   [ ✏ (disabled) ]
On deactivate  — Not configured   [ ✏ (disabled) ]
```

### Screen / Button Config section

Shows ItemList when `selection.type === 'screen'`, ButtonInspector when `selection.type === 'button'`, and a muted "Select a button or the screen" hint when `selection` is null.

---

## State Bar Changes

The state bar gains two icon buttons to the right of the dropdown.

```
[ ← state dropdown (16rem) ]  [ + Add ]  [ 🗑 Delete ]
```

The Delete button is **disabled** when the selected state is the Root state.

### Add State

Clicking **Add** immediately creates a new state with defaults and selects it — no dialog:

1. Assign the new state an ID of `max(existing ids) + 1`.
2. Set `name` to `"New State"`.
3. Set `stateType` to `"persistent"`.
4. Initialize remaining fields to defaults (see table below).
5. Push onto `remoteConfig.states`.
6. Set `selectedStateId` to the new state's ID.
7. Clear `selection` (bottom section shows the hint until the user clicks).

The State Settings section is forced open and the name input receives focus so the user can immediately rename it.

| Field | Default |
|---|---|
| `items` | `[]` |
| `buttonConfigs` | `[]` |
| `onActivate` | `[]` |
| `onDeactivate` | `[]` |
| `buttonFallback` | `false` |

### Delete State

Clicking **Delete** shows a confirmation `sl-dialog` ("Delete State?") with the state name in the body, a **Delete** danger button, and a **Cancel** link button.

On confirm:
1. Remove the state from `remoteConfig.states`.
2. Set `selectedStateId` to `remoteConfig.rootStateId`.
3. Clear `selection`.

---

## RemotePreview Changes

- **No horizontal panning:** dragging only moves the remote vertically. Horizontal mouse movement still contributes to the `dragMoved` threshold so click-vs-drag detection is unaffected.
- **Always horizontally centered:** `tx` is always computed as `(viewportWidth - svgNaturalWidth * scale) / 2`. This applies to wheel zoom, click-to-focus zoom, and the initial fit. `svgNaturalWidth` is captured once on the first fit call.
- **Zoom clamped:** `MIN_SCALE = 0.25`, `MAX_SCALE = 5`. Wheel zoom and click-to-focus both respect this range.

---

## Constraints

| Constraint | Enforcement |
|---|---|
| Exactly one Root state | Add always creates Persistent; no type-change path to Root |
| Root cannot be deleted | Delete button disabled when selected state is Root |
| Root type is locked | Root renders a badge, not a type switch |
| Root has no fallback | buttonFallback switch hidden on Root |

---

## Component Changes

- **`StateSettings.svelte`** (new): renders the top section — name input, type switch/badge, buttonFallback, macro stubs. Props: `activeState` (named to avoid Svelte 5 `$state` rune conflict), `focusTrigger`, `onUpdate`.
- **`ScreenInspector.svelte`** (reduced): now a thin wrapper that renders only `ItemList`.
- **`InspectorPanel.svelte`**: renders `StateSettings` unconditionally, then a full-width divider, then the selection-driven content. Accepts `focusTrigger` prop threaded through to `StateSettings`. Panel header title is always "Properties".
- **`App.svelte`**: gains `handleStateAdd()`, `handleStateDelete()`, `confirmStateDelete()`, `nameInputFocusTrigger` counter, `pendingDeleteName` for the dialog, and `deleteDialogEl` ref.
