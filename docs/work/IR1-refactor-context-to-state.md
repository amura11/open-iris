# Refactor: Context → State

Replace the `Context` concept with a richer `State` model. The old `can_activate` boolean is replaced by a three-value `stateType` enum that cleanly expresses the three logical roles a state can play, and a `buttonFallback` flag is added to support button config inheritance in ephemeral states.

---

## Terminology Changes

| Old | New |
|---|---|
| Context | State |
| ContextId | StateId |
| can_activate: false | stateType: Ephemeral |
| can_activate: true | stateType: Persistent |
| *(new)* | stateType: Root |
| RemoteConfig.contexts | RemoteConfig.states |
| RemoteConfig.rootContextId | RemoteConfig.rootStateId |

**State type definitions:**

| Type | Description |
|---|---|
| **Root** | Always present, exactly one per config. The remote's home screen. Shown when there is no active state. Not activatable. No macros. |
| **Persistent** | Represents a durable activity (e.g. "Watching TV"). Navigating to one makes it the active state. Only one persistent state is active at a time. Supports onActivate / onDeactivate macros (stubbed). |
| **Ephemeral** | A one-off overlay or menu. Does not change the active state. Can optionally inherit button configs from the active state. No macros. |

**Working names:** Root, Persistent, Ephemeral are working names. They are accurate and usable but not locked.

---

## Navigation Model

### Stack

Navigation is stack-based. The stack always has at least one entry (Root or the active Persistent state). Ephemeral states are pushed onto the stack. Navigating to a Persistent state activates it and resets the stack to `[active state]`.

### Home Button

| Current position | Action |
|---|---|
| Root, no active state | No-op |
| Root, active state exists | Go to active state |
| Active state | Go to Root |
| Ephemeral, active state exists | Go to active state |
| Ephemeral, no active state | Go to Root |

### Back Button

| Current position | Action |
|---|---|
| Root, no active state | No-op |
| Root, active state exists | Go to active state |
| Active state | Go to Root |
| Ephemeral | Pop — return to previous state in stack |

### Power Button

Deactivates the current active state (runs onDeactivate — see note below), clears the active state, navigates to Root.

> **Deferred ambiguity:** Whether onDeactivate runs when switching between active states vs. only on power-down is unresolved. For now, stub both macros as empty. When implemented, the configurator must let users configure when deactivation runs.

### Activation

A Persistent state becomes active when it is navigated to (e.g. via a button action or menu item that targets it). When a new Persistent state is activated:
1. onDeactivate runs on the previously active state (stubbed).
2. The new state becomes active.
3. The navigation stack resets to `[new active state]`.
4. onActivate runs on the new state (stubbed).

---

## Button Fallback

Ephemeral states have a `buttonFallback: boolean` field. When `true`, any button not explicitly configured on the ephemeral state resolves to the active state's config for that button (if an active state exists). When `false` (or no active state), unset buttons are inert.

This flag is only meaningful on Ephemeral states. The configurator must not expose it for Root or Persistent states.

---

## TypeScript Model Changes

**File:** `source/configurator/src/model/context.ts` → rename to `source/configurator/src/model/state.ts`

```typescript
export type StateId = number;
export type ItemId  = number;

export type StateType = 'root' | 'persistent' | 'ephemeral';

export interface Item {
    id: ItemId;
    label: string;
}

export interface State {
    id: StateId;
    name: string;
    stateType: StateType;
    items: Item[];
    buttonConfigs: [];        // Stubbed — will hold per-button action assignments
    onActivate: [];           // Stubbed — Persistent only; ignored on Root/Ephemeral
    onDeactivate: [];         // Stubbed — Persistent only; ignored on Root/Ephemeral
    buttonFallback: boolean;  // Ephemeral only; ignored on Root/Persistent
}

export interface RemoteConfig {
    rootStateId: StateId;
    states: State[];
}
```

---

## Binary Format Changes

Version bumps from `0x01` to `0x02`. This is a breaking change — the reader must reject v1 files.

### Header

```
magic            4 bytes   "IRIS" (unchanged)
version          1 byte    0x02  ← was 0x01
root_state_id    2 bytes   little-endian uint16  ← was root_context_id (same encoding)
```

### Manifest

Type tag `0x01` now represents states (was contexts). No structural change to the manifest itself.

### State Record (was Context Record)

```
id               2 bytes
state_type       1 byte    0x00 = root | 0x01 = persistent | 0x02 = ephemeral
                           ← was can_activate: 0x00 = false, 0x01 = true
button_fallback  1 byte    0x00 = false | 0x01 = true  ← new field
name_offset      4 bytes   byte offset into string blob (unchanged)
item_count       2 bytes   (unchanged)
item_ids         item_count × 2 bytes (unchanged)
```

---

## C Type Changes

**File:** `source/firmware/components/config/include/config.h`

```c
typedef enum {
    STATE_TYPE_ROOT       = 0x00,
    STATE_TYPE_PERSISTENT = 0x01,
    STATE_TYPE_EPHEMERAL  = 0x02,
} state_type_t;

typedef struct { uint16_t id; const char *label; } item_t;

typedef struct {
    uint16_t id;
    state_type_t type;
    bool button_fallback;
    const char *name;
    uint16_t item_count;
    item_t *items;
    // Persistent only: on_activate / on_deactivate command sequences — stubbed
} state_t;

typedef struct {
    state_t *states;
    uint16_t state_count;
    uint16_t root_state_id;
    char *string_blob;
    uint8_t *raw_buffer;
} config_t;
```

---

## Configurator Code Changes

### Model

- Rename `source/configurator/src/model/context.ts` → `state.ts`
- Replace all `Context` / `ContextId` / `contexts` / `rootContextId` with `State` / `StateId` / `states` / `rootStateId`
- Replace `canActivate: boolean` with `stateType: StateType`
- Add `buttonFallback: boolean`
- Update `@model` alias if needed (vite.config.ts)

### Serialization

- `writer.ts`: bump version to `0x02`, write `state_type` byte (enum value), write `button_fallback` byte, update all symbol names
- `reader.ts`: reject version `!= 0x02`, read `state_type` as enum, read `button_fallback`

### UI

**ScreenInspector.svelte** (currently shows can_activate badge):
- Replace the boolean badge with a state type badge: Root / Persistent / Ephemeral
- Show the buttonFallback toggle only when `stateType === 'ephemeral'`

**App.svelte / ItemList.svelte / ItemEditor.svelte:**
- Update all `context` / `Context` variable and prop names to `state` / `State`

### Configurator Constraints

The configurator must enforce:
- Exactly one Root state per config (one must always exist; the user cannot delete it or add a second)
- onActivate / onDeactivate not exposed for Root or Ephemeral states
- buttonFallback not exposed for Root or Persistent states
- Navigation targets that point to a Persistent state imply activation (when button actions are implemented)

---

## Docs to Update

Once the code changes are complete, update these documents to remove all Context / can_activate language:

| File | Changes |
|---|---|
| `docs/overview.md` | Terminology table — replace Context/can_activate rows with State/stateType/Ephemeral/Persistent/Root rows |
| `docs/config-data-model.md` | TypeScript types block, C types block, binary format block, all prose references |
| `docs/configurator.md` | File structure entry for `model/state.ts`; ScreenInspector description; serialization section |
| `docs/firmware.md` | C types block, all prose references |
| Memory: `project_terminology.md` | Replace with new terminology |

---

## Out of Scope for This Refactor

- Button config action assignment (still deferred)
- Navigation stack runtime implementation (firmware, deferred)
- onActivate / onDeactivate execution (deferred)
- Power button hardware wiring (deferred)
- Resolving the deactivation timing ambiguity (deferred)
