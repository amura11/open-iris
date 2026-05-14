# Button Assignment UI

**Goal:** Implement the configurator UI for assigning actions to physical and screen buttons. Users should be able to assign a single action, build a multi-action sequence, or pick an existing named sequence. Naming is never required — only multi-action sequences that the user explicitly wants to reuse ever get a name.

Depends on IR4 (device model, metadata, and device library UI).

---

## Terminology

| Term | Definition |
|---|---|
| **Anonymous sequence** | A sequence with no `name` in its `SequenceAnnotation`. Created automatically when a single action or an unnamed multi-action is assigned. Never appears in the reusable sequence picker. |
| **Named sequence** | A multi-action sequence the user has explicitly promoted to reusable by giving it a name. Stored with a `name` in its `SequenceAnnotation`. Appears in the reusable sequence picker. |
| **Button inspector** | The sidebar panel that appears when a button is selected (physical or screen). Currently exists in `ButtonInspector.svelte`. |

---

## Sequence Naming Rules

| Sequence type | Named? | Reusable? |
|---|---|---|
| Single action (any type) | Never | Never |
| Multi-action, default | No | No |
| Multi-action, promoted | Yes (user-entered) | Yes |

Single-action sequences are always created fresh per button assignment. The configurator never prompts for a name and never offers a single-action sequence in the reusable picker, regardless of content.

Multi-action sequences are anonymous by default. An explicit "Save as reusable" opt-in (see UX below) is the only path to naming.

---

## Sequence Annotations

Every sequence gets a `SequenceAnnotation` — including anonymous ones. This allows the inspector to always display a human-readable label without reverse-looking up IR codes through devices.

```ts
export interface SequenceAnnotation {
    sequenceId: SequenceId;
    name?: string;          // present only for named/reusable sequences
    deviceId?: DeviceId;    // set when created from a device function
    functionName?: string;  // set when created from a device function; co-present with deviceId
}
```

- `name` is absent for anonymous sequences; present and user-entered for named ones.
- `deviceId` and `functionName` are set whenever the sequence was created from a device function (IR or REST). The inspector uses these to display "TV → Power" rather than a raw code ID.
- A sequence can have `deviceId`/`functionName` without `name` (anonymous but device-backed) — this is the common case for single-action IR assignments.

---

## Action Model

All IR and REST actions are created through a device function. There is no raw code entry path. Every `ir_send` or `rest_call` action originates from a `DeviceFunction` template, and the resulting `SequenceAnnotation` carries `deviceId`/`functionName` back to that device and function.

System actions (Navigate, Pause) have no device source and leave `deviceId`/`functionName` unset.

---

## Assignment UX

### Action Picker

The action picker is used in both the single-action flow and the sequence editor. It is divided into two sections:

**Devices**
Lists every configured device with its functions as inline selectable items. Selecting a function creates the corresponding action from the device's `ActionTemplate`.

If no devices are configured, this section is replaced by a notice: "No devices configured — add one in the Device Library" with a link to the device library panel.

**System**
- **Navigate** — opens an inline `NavigateActionEditor` component to pick a target state
- **Pause** — opens an inline `PauseActionEditor` component to enter a duration

Each system action type has its own editor component so additional action types can be added independently over time. Inline editors appear within the picker (both in the inspector and inside the sequence editor modal) without opening a secondary modal.

### Assigning a single action

The button inspector shows the action picker. Selecting any item (device function or system action) creates a new anonymous `Sequence` with a single `Action`, attaches a `SequenceAnnotation` with `deviceId`/`functionName` set if device-backed, and assigns it to the button. No name prompt.

### Building a multi-action sequence

A **"Multi-action sequence"** option below the action picker opens the sequence editor in a **modal dialog**. The editor allows:

- Adding actions (same action picker as above, presented inline within the modal)
- Reordering actions
- Removing actions

At the bottom of the editor: a **"Save as reusable"** toggle, off by default. When toggled on, a name field appears. The user may leave this off and the sequence will be anonymous.

Confirming creates the sequence and assigns it to the button. Cancelling discards all edits and restores the button's previous assignment (or leaves it unassigned if it had none).

### Picking an existing named sequence

The assignment picker includes a **"Saved sequences"** section listing all named sequences by their annotation name. This section is hidden when no named sequences exist. Selecting one assigns its `SequenceId` to the button directly — no copy is made.

---

## Editing an Existing Assignment

When a button already has an assignment, the inspector shows the current assignment and an option to change it. The label is derived from the `SequenceAnnotation`: "Device → Function" for device-backed single actions, the sequence name for named sequences, or "N actions" for anonymous multi-action sequences.

- **Anonymous sequence:** editing opens the same flow as creating (action picker or sequence editor modal). A new sequence is created; the old one is discarded if no other button references it.
- **Named sequence:** editing offers two choices — "Edit this sequence" (modifies the shared sequence, affects all buttons using it) or "Replace" (opens the full picker to assign something different).

> **Decision:** "Edit this sequence" on a named sequence shows a warning listing all buttons that currently use it. Usage is computed at the time the warning is shown by scanning all buttons across all states for a matching `SequenceId` — no references are stored in the annotation. This scan is always accurate and avoids stale reference problems.
>
> A natural follow-on: after assigning a single-action sequence, the configurator could scan for other sequences with identical actions and offer to consolidate them into one. No additional infrastructure is needed beyond the same scan approach.

---

## Orphaned Sequences

When a button is reassigned and the old sequence was anonymous, the configurator should garbage-collect sequences (and their annotations) that are no longer referenced by any button in any state.

Named sequences are never garbage-collected automatically — the user must delete them explicitly from the device/sequence library.

> **Open question:** Where is the UI for managing (renaming, deleting) named sequences? Options: a dedicated "Sequences" panel, inline within the assignment picker, or discoverable only from a button that uses them.

---

## Empty State

A button with no assignment shows the action picker directly in the inspector, so the user can assign it without an extra step. There is no intermediate "unassigned" placeholder screen.

---

## Open Questions

1. **Multi-action reorder UX** — drag-and-drop or up/down arrows?
2. **Named sequence management UI** — where does the user rename or delete named sequences? Options: a dedicated "Sequences" panel, inline within the assignment picker, or discoverable only from a button that uses them.

---

## Future Work

- **Per-sequence button tracking** — `SequenceAnnotation` should eventually store a list of `{ stateId: StateId; buttonId: ButtonCode | ScreenButtonId }` tuples recording which buttons reference it. Physical buttons use `ButtonCode` as the stable ID; screen buttons will need a stable ID added to `ScreenButtonConfig` before this is possible.
- **Single-action de-duplication** — after assigning a single-action sequence, offer to consolidate with any existing sequence that has identical actions. Implemented as a scan; no model changes required.
