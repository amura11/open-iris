# Buttons and Actions Data Model

**Goal:** Introduce the button config and action data model in the configurator. Establishes TypeScript types for Actions, Sequences, PhysicalButtonConfigs, and ScreenButtonConfigs (replacing Items); updates the binary writer to format version `0x03`; and renames Item-related UI components. Binary format and C type details are maintained in `docs/config-data-model.md`. UI for assigning actions to buttons and all firmware implementation are out of scope for this ticket.

---

## Terminology

| Old | New |
|---|---|
| Item | ScreenButtonConfig |
| ItemId | ScreenButtonId |
| `state.items` | `state.screenButtons` |
| *(new)* | Action |
| *(new)* | ActionType |
| *(new)* | Sequence / SequenceId |
| *(new)* | PhysicalButtonConfig |

**New concepts:**

| Term | Definition |
|---|---|
| **Action** | A single operation: a type tag plus 4 bytes of type-specific parameters. The type determines how the bytes are interpreted. |
| **ActionType** | An enum identifying what an action does (e.g. navigate, send IR code, pause). Values are TBD and will be defined when firmware action dispatch is implemented. |
| **Sequence** | An ordered list of one or more Actions with a stable ID. Sequences are stored in a global pool on `RemoteConfig` and referenced by ID from any state. A sequence with a single action is still a Sequence. |
| **PhysicalButtonConfig** | Maps a physical button (by ButtonCode) to a Sequence within a given State. |
| **ScreenButtonConfig** | An on-display tappable button shown within a State. Has a label, optional icon, and a Sequence. Replaces Item. |

---

## TypeScript Model

**New file:** `source/configurator/src/model/actions.ts`

```typescript
export type SequenceId     = number;
export type ScreenButtonId = number;

export type ActionType =
    | 'navigate'    // params[0..1]: target StateId (uint16, little-endian)
    | 'ir_send'     // params[0..3]: IR code (uint32, little-endian)
    | 'pause'       // params[0..1]: duration in ms (uint16, little-endian)
    | 'rest_call';  // params[0]: request pool ID (uint8); additional types TBD

export interface Action {
    type: ActionType;
    params: [number, number, number, number];  // 4 bytes; unused bytes are 0x00
}

export interface Sequence {
    id: SequenceId;
    name?: string;      // configurator only; not stored in firmware-readable sections
    actions: Action[];  // at least one entry
}

export interface PhysicalButtonConfig {
    buttonCode: ButtonCode;
    sequenceId: SequenceId;
}

export interface ScreenButtonConfig {
    id: ScreenButtonId;   // stable ID for configurator UI tracking; positional in binary
    label: string;
    icon?: string;        // icon identifier; format TBD
    sequenceId: SequenceId;
}
```

**Updated `source/configurator/src/model/state.ts`:**

```typescript
export interface State {
    id: StateId;
    name: string;
    stateType: StateType;
    screenButtons: ScreenButtonConfig[];   // ordered; determines display order
    physicalButtons: PhysicalButtonConfig[];
    onActivate: SequenceId | null;         // Persistent only; null = not configured
    onDeactivate: SequenceId | null;       // Persistent only; null = not configured
    buttonFallback: boolean;               // Ephemeral only
}

export interface RemoteConfig {
    rootStateId: StateId;
    states: State[];
    sequences: Sequence[];                 // global pool; shared across all states
}
```

Remove `Item` and `ItemId` from `state.ts` — superseded by `ScreenButtonConfig` and `ScreenButtonId` in `actions.ts`.

---

## Configurator Code Changes

### Model

- New file: `source/configurator/src/model/actions.ts` — `Action`, `ActionType`, `Sequence`, `SequenceId`, `PhysicalButtonConfig`, `ScreenButtonConfig`, `ScreenButtonId`
- Update `source/configurator/src/model/state.ts` — remove `Item`/`ItemId`; replace `items` with `screenButtons` and `physicalButtons`; replace `buttonConfigs`, `onActivate`, `onDeactivate` stubs with typed fields; add `sequences` to `RemoteConfig`

### Serialization

Update `writer.ts` and `reader.ts` to format version `0x03` as specified in `docs/config-data-model.md`.

- `writer.ts`: bump version to `0x03`; write states section with embedded screen button configs and physical button configs; write sequences section; write configurator metadata section (sequence names)
- `reader.ts`: reject version `!= 0x03`; read updated state record fields; read sequences section

### UI (rename only — no functional changes in this ticket)

- Replace all `item` / `Item` / `ItemId` references with `screenButton` / `ScreenButtonConfig` / `ScreenButtonId`
- `ItemList.svelte` → `ScreenButtonList.svelte` (rename; interface unchanged for now)
- `ItemEditor.svelte` → `ScreenButtonEditor.svelte` (rename; interface unchanged for now)
- `ScreenInspector.svelte`: update prop types

---

## Out of Scope

- UI for assigning sequences to buttons and editing actions
- Firmware implementation — see `docs/config-data-model.md` for binary format and C type reference; see `temp/firmware-config-loading.md` for loading model notes
- ActionType enum values and C header (`action_types.h`) — defined when dispatch is implemented
- Icon identifier format
- REST request pool format
