# Button Assignment UI

**Goal:** Implement the configurator UI for assigning actions to physical and screen buttons. Users should be able to assign a single action, build a multi-action sequence, or pick an existing named sequence. Naming is never required — only multi-action sequences that the user explicitly wants to reuse ever get a name.

Depends on IR4 (device model, metadata, and device library UI).

---

## Terminology

| Term | Definition |
|---|---|
| **Anonymous sequence** | A sequence with no `SequenceAnnotation` name. Created automatically when a single action or an unnamed multi-action is assigned. Never appears in the reusable sequence picker. |
| **Named sequence** | A multi-action sequence the user has explicitly promoted to reusable by giving it a name. Stored with a `SequenceAnnotation`. Appears in the reusable sequence picker. |
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

## Assignment UX

### Assigning a single action

The button inspector shows an action picker with the following options:

- **Navigate** — pick a target state
- **IR code** — enter a raw code (hex input) or pick from a device function (requires IR4)
- **REST call** — enter URL and method (details TBD, see IR4 open questions)
- **Pause** — enter duration

Selecting any of these creates a new anonymous single-action sequence and assigns it to the button. No name prompt. No opt-in.

### Building a multi-action sequence

A "Multi-action" option in the picker opens a sequence editor modal/panel. The editor allows:

- Adding actions (same picker as single-action above)
- Reordering actions
- Removing actions

At the bottom of the editor: a **"Save as reusable"** toggle, off by default. When toggled on, a name field appears. The user may leave this off and the sequence will be anonymous.

Confirming creates the sequence and assigns it to the button.

### Picking an existing named sequence

The assignment picker includes a **"Saved sequences"** section listing all named sequences by their annotation name. Selecting one assigns its `SequenceId` to the button directly — no copy is made.

---

## Editing an Existing Assignment

When a button already has an assignment, the inspector shows the current assignment and an option to change it.

- **Anonymous sequence:** editing opens the same flow as creating (single-action picker or sequence editor). A new sequence is created; the old one is discarded if no other button references it.
- **Named sequence:** editing offers two choices — "Edit this sequence" (modifies the shared sequence, affects all buttons using it) or "Replace" (opens the full picker to assign something different).

> **Open question:** Should "Edit this sequence" on a named sequence warn the user that other buttons will be affected? How should the configurator surface which other buttons share it?

---

## Device Function Integration (IR4 dependency)

When picking an IR or REST action, if any devices are defined, the picker shows a device browser alongside the manual entry fields. Selecting a device function populates the action fields and marks the resulting sequence with a `source` annotation (see IR4). This is a convenience — the user can still enter codes manually.

> **Open question:** Should device functions appear as a top-level section in the single-action picker, or as a sub-option within "IR code" and "REST call"? Top-level is more discoverable; sub-option keeps the picker shorter when no devices are configured.

---

## Orphaned Sequences

When a button is reassigned and the old sequence was anonymous, the configurator should garbage-collect sequences that are no longer referenced by any button in any state.

Named sequences are never garbage-collected automatically — the user must delete them explicitly from the device/sequence library.

> **Open question:** Where is the UI for managing (renaming, deleting) named sequences? Options: a dedicated "Sequences" panel, inline within the assignment picker, or discoverable only from a button that uses them.

---

## Open Questions

1. **Sequence editor placement** — modal dialog vs. inline expansion in the inspector vs. a separate panel?
2. **Multi-action reorder UX** — drag-and-drop or up/down arrows?
3. **Named sequence management UI** — where does the user rename or delete named sequences? (see above)
4. **Conflict warning on shared sequence edit** — how prominently should "other buttons use this" be surfaced?
5. **Physical vs. screen button differences** — are there any assignment restrictions specific to physical buttons that affect the picker UI?
6. **Empty state** — what does the inspector show for a button with no assignment? A prompt to assign, or nothing?
