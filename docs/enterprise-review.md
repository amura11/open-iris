# Enterprise Architecture Review

This document captures an architectural review of the OpenIRis codebase from an enterprise software engineering perspective. It covers project layout, configurator frontend architecture, firmware architecture, and cross-cutting concerns. Issues are grouped by area and ordered by priority within each section.

---

## 1. Project Layout

### Strengths

- Clean separation between `source/configurator/` and `source/firmware/` — the two major deliverables have no file-system entanglement.
- `docs/` holds authoritative specs (`overview.md`, `configurator.md`, `firmware.md`, `config-data-model.md`).
- `docs/work/` functions as a lightweight issue tracker with IR-prefixed specs.
- `.devcontainer/` gives reproducible environments.
- Per-subsystem `agents.md` files document coding conventions in a discoverable way.

### Issues

**1.1 No CI/CD pipeline**
There are zero GitHub Actions workflows. Nothing validates pull requests, enforces type checking, or builds on merge.

Recommended additions in priority order:
1. `ci.yml` — on PR: `npm run check` (svelte-check) + `npm run build`
2. `firmware.yml` — on PR: `idf.py build` inside the devcontainer image
3. `release.yml` — on tag: build configurator, attach `dist.zip` and schema docs to a GitHub Release

---

**1.2 No tests anywhere**
Neither the configurator nor the firmware has a single test. The serialization round-trip (`writer.ts` → `remote.bin` → `config.c`) is the most critical integration point in the entire project and is completely untested.

Recommended additions:
- Configurator: add `vitest` and write round-trip tests for `serialization/writer.ts` ↔ `serialization/reader.ts`. These are pure functions with no UI dependency — lowest-effort, highest-value tests possible.
- Firmware: use the Unity test framework (bundled with ESP-IDF) to test `config.c` against known-good `.bin` fixtures.
- Wire both into CI.

---

**1.3 No linting**
The configurator has Prettier (formatting) and `svelte-check` (type checking) but no ESLint. Logic errors, unused variables, and unsafe patterns are not caught automatically.

Recommendation: add `eslint` + `eslint-plugin-svelte` + `@typescript-eslint/eslint-plugin` and wire it into CI.

---

**1.4 No monorepo tooling**
The configurator is a standalone npm project with no workspace-level structure. If shared TypeScript types (see §3) are ever extracted into a package, there is no infrastructure to host them.

Recommendation: add a root-level `package.json` with npm/pnpm workspaces now, before it becomes painful to retrofit.

---

**1.5 Specification / code drift risk**
`docs/config-data-model.md` is a prose description of the binary format. The C parser (`config.c`) and the TypeScript writer (`serialization/writer.ts`) are independent implementations of that prose. There is no machine-readable schema and no automated check that the three stay aligned. See §3.1 for the full recommendation.

---

## 2. Configurator Architecture

### Strengths

- Unidirectional data flow (props down, callbacks up) is enforced consistently — no shared mutable stores, no event bus.
- Domain model in `src/model/` is clean and well-typed.
- Serialization is fully decoupled from the UI in `src/serialization/`.
- Layout descriptor abstraction (`layouts/*.toml`) makes the app multi-skin without code changes.
- Offline-first design is correct for this use case.

### Issues

**2.1 God Component**
`App.svelte` is ~506 lines and owns 100% of application state: `remoteConfig`, `selectedStateId`, `selection`, five dialog open flags, panel sizing, and all mutation handlers. This is a God Component anti-pattern.

Consequences:
- Every feature addition requires editing the root component.
- Props must be threaded 4–6 levels deep to reach leaf components.
- The component cannot be tested in isolation.
- Cognitive overhead grows super-linearly as state surface expands.

Recommendation: extract a `ConfigStore` Svelte 5 class-based reactive store in `src/stores/config-store.svelte.ts`. App.svelte becomes a thin layout shell; components import the store directly instead of receiving callbacks five props deep.

```typescript
// src/stores/config-store.svelte.ts
export class ConfigStore {
    remoteConfig = $state<RemoteConfig>(createDefaultConfig());
    selectedStateId = $state<StateId | null>(null);
    selection = $state<Selection>({ type: 'screen' });

    addState(name: string, type: StateType) { ... }
    deleteState(stateId: StateId) { ... }
    updateButtonAssignment(...) { ... }
}

export const configStore = new ConfigStore();
```

---

**2.2 No service layer**
Business logic is split across `model/assignment-utils.ts`, `App.svelte`, and individual components with no clear boundary between "UI component" and "business operation."

Recommendation: create `src/services/` with named use-case modules:
- `config-service.ts` — CRUD for states, devices, sequences
- `assignment-service.ts` — button assignment operations and GC
- `import-export-service.ts` — bin round-trip

The current `assignment-utils.ts` is a natural seed for `assignment-service.ts`.

---

**2.3 Weak nominal types for IDs**
All four ID types are structurally identical:

```typescript
export type StateId    = number;
export type DeviceId   = number;
export type SequenceId = number;
```

TypeScript will not catch a `DeviceId` passed where a `StateId` is required.

Recommendation: use branded types:

```typescript
declare const _brand: unique symbol;
type Brand<T, B> = T & { readonly [_brand]: B };

export type StateId    = Brand<number, 'StateId'>;
export type DeviceId   = Brand<number, 'DeviceId'>;
export type SequenceId = Brand<number, 'SequenceId'>;
```

Cast only at creation sites (`id as StateId`). The type checker prevents cross-ID substitution everywhere else at zero runtime cost.

---

**2.4 String-keyed action discrimination**
`ButtonActionPanel` constructs string keys such as `device:${deviceId}:${functionId}` and `system:navigate` to identify selected actions. String matching is brittle — a typo silently produces a no-op.

Recommendation: replace with a discriminated union and exhaustive `switch`:

```typescript
type ActionKey =
    | { type: 'device'; deviceId: DeviceId; functionId: FunctionId }
    | { type: 'system'; function: SystemFunction }
    | { type: 'sequence'; sequenceId: SequenceId };
```

---

**2.5 No central validation layer**
Validation logic is scattered:
- State deletion guard in `App.svelte`
- Button assignment validation in `ButtonInspector`
- Sequence GC logic in `assignment-utils.ts`

Recommendation: create `src/validation/config-validators.ts` with named validator functions:

```typescript
export function canDeleteState(config: RemoteConfig, stateId: StateId): ValidationResult
export function canAssignAction(config: RemoteConfig, buttonCode: ButtonCode, action: ActionKey): ValidationResult
```

Components call validators before mutations; validators are unit-testable in isolation.

---

**2.6 Incomplete sequence garbage collection**
`garbageCollect()` only removes anonymous sequences. Named sequences that lose all references persist in exported `.bin` files forever, silently growing file size.

Recommendation: implement full reference-counting GC — walk all button assignments, collect all referenced `SequenceId`s, then remove any sequence not in that set regardless of whether it has a name.

---

**2.7 Accessibility suppressions**
Multiple `svelte-ignore a11y_*` directives indicate `<div>` elements acting as interactive controls without keyboard support. This is a WCAG 2.1 AA failure.

Recommendation: replace interactive `<div>`s with `<button>` elements. Add `role`, `tabindex`, and `onkeydown` handlers for SVG areas where `<button>` is not appropriate.

---

**2.8 No undo/redo**
Every mutation is immediately committed with no history. In a configuration tool, Ctrl+Z is a strong user expectation.

Recommendation: implement a simple command stack capped at ~50 entries, with Ctrl+Z / Ctrl+Y keyboard bindings.

---

**2.9 Component directory is flat**
All 18 components live in one directory with no grouping. The components fall into four natural domains. See §5 for the full reorganization proposal.

---

## 3. Cross-Cutting Concerns (Configurator ↔ Firmware)

These are the highest-risk issues in the codebase because they span the integration boundary.

### 3.1 Binary format has no machine-readable schema (critical)

The `remote.bin` format is implemented independently in:
- TypeScript: `serialization/writer.ts` + `serialization/reader.ts`
- C: `components/config/config.c` + `config_pool.c`

The only shared artifact is prose in `docs/config-data-model.md`. There is no generated code, no schema validation, and no round-trip test. A single byte-offset mistake in either implementation produces silent corruption.

Recommendation (options in priority order):
1. **Kaitai Struct** (`.ksy` file) — a binary format DSL that generates both TypeScript and C parsers from a single spec, eliminating both hand-written implementations.
2. **Custom codegen** — a small Python/Node script that reads a YAML/JSON schema and emits offset constants for both C and TypeScript. Lower effort than full Kaitai adoption.
3. **At minimum:** add a round-trip integration test (`writer.ts` produces bytes → C parser consumes them → compare field values) to CI immediately.

---

### 3.2 Button codes manually synchronized

`source/configurator/src/model/button-codes.ts` carries a comment: *"Manually kept in sync with button_codes.h."* The header itself is also duplicated between `components/config/include/` and `components/types/include/`.

Every button addition or rename requires editing two or three files in sync. This will drift.

Recommendation:
1. Eliminate the duplicate `button_codes.h` — keep one copy in `components/types/include/`.
2. Generate `button-codes.ts` from `button_codes.h` via a build-step script (a ~20-line Node script). Wire into the Vite build or as a `prebuild` npm script.

---

### 3.3 No format versioning policy

The binary header has a version byte but it is referenced inconsistently across the codebase. There is no documented policy for what constitutes a breaking vs. non-breaking format change, and no migration or compatibility strategy.

Recommendation: document a versioning policy in `docs/config-data-model.md` covering:
- What the version byte means and what the current value is
- Which changes are backwards-compatible (e.g., additive new sections)
- What firmware should do when it encounters an unknown version number

---

## 4. Firmware Architecture

### Strengths

- ESP-IDF component model used correctly — clean `include/` / `src/` / `CMakeLists.txt` per component.
- `iris_reader_t` I/O abstraction (function pointer + context) is well-engineered and allows SD card, SPIFFS, buffer, or future network backing without changing the parser.
- Consistent `esp_err_t` error propagation throughout.
- Header-only `types` component avoids circular dependencies.

### Issues

**4.1 Stubs not tracked as work items**
The firmware has significant TODO/stub code — `display_init()`, SD card FATFS mount in `main.c`, `execute_ir_action()`, and `execute_rest_action()` — none of which are linked to entries in `docs/work/`. Untracked stubs are invisible debt.

Recommendation: create IR-prefixed work items for each stub. Add `// TODO(IR-NN): description` comments in source to link code to the tracker.

---

**4.2 Memory fragmentation from per-string malloc**
In `config_pool.c`, every device name, function name, button label, and URL is individually `malloc`'d via `heap_copy_string()`. For a config with 30 devices × 10 functions, this creates 300+ small heap allocations on ESP32's 520KB SRAM — a real fragmentation risk.

Recommendation: implement a string arena (bump allocator) for config loading:

```c
typedef struct {
    uint8_t *base;
    size_t   used;
    size_t   capacity;
} iris_arena_t;
```

Allocate one buffer sized to the config file, copy all strings into it, and free the entire arena in `iris_config_free()` with a single `free()`. This also simplifies the cleanup path.

---

**4.3 No input handling architecture**
The main loop only calls `display_tick()` every 5ms. There is no GPIO ISR, no debounce layer, no FreeRTOS queue for button events, and no dispatch path from a physical button press to the action executor. This is the most important missing subsystem for a functional device.

Recommendation: design and document the full input pipeline in `docs/firmware.md` before implementing more UI code:
1. GPIO ISR → push `ButtonCode` to a FreeRTOS `QueueHandle_t`
2. Input task dequeues events, applies debounce
3. Input task calls `action_execute(button_code, current_state, config)`
4. Action executor navigates states, fires IR/REST

---

**4.4 No active-state tracking**
`ui_render_state()` takes a state pointer and renders it, but nothing tracks which state is currently displayed. `system:navigate` actions in `action.c` only log — they do not change any global current-state variable.

Recommendation: add a `ui_navigate_to(iris_state_id_t state_id, iris_config_t *config)` function and a module-level `current_state` variable in `ui.c`. All `system:navigate` action execution dispatches through `ui_navigate_to`.

---

## 5. Component Directory Reorganization

The current `src/components/` directory contains 18 flat files with no grouping. The components fall into four natural domains.

### Proposed layout

```
src/components/
├── preview/
│   └── RemotePreview.svelte
├── inspector/
│   ├── InspectorPanel.svelte
│   ├── ScreenInspector.svelte
│   ├── ScreenButtonList.svelte
│   ├── ScreenButtonRow.svelte
│   ├── ScreenButtonEditor.svelte
│   ├── ButtonInspector.svelte
│   └── ButtonActionPanel.svelte
├── action/
│   ├── ActionPicker.svelte
│   ├── ActionCombobox.svelte
│   ├── SingleActionEditor.svelte
│   ├── SequenceActionEditor.svelte
│   ├── NavigateActionEditor.svelte
│   └── PauseActionEditor.svelte
└── dialogs/
    ├── StateEditDialog.svelte
    ├── SequenceEditorDialog.svelte
    ├── DeviceDiscoveryDialog.svelte
    └── DeviceDetailPanel.svelte
```

### Rationale for each group

| Group | Cohesion rule |
|---|---|
| `preview/` | Renders the remote skin SVG; owns pan/zoom and hit-testing |
| `inspector/` | Components that only appear inside the inspector panel |
| `action/` | Pure action-assignment UI; reusable across inspector and dialogs |
| `dialogs/` | Components mounted as modal portals / full overlays |

`DeviceDetailPanel.svelte` sits in `dialogs/` alongside `DeviceDiscoveryDialog.svelte` since it is only ever used inside that dialog. A deeper `dialogs/device-discovery/` subfolder is unnecessary at this scale; revisit if `dialogs/` grows beyond ~8 files.

The `@components` path alias in `vite.config.ts` requires no change — imports like `@components/inspector/InspectorPanel.svelte` are more descriptive than the current flat form.

---

## 6. Priority Matrix

| Issue | Area | Priority |
|---|---|---|
| No tests (serialization round-trip) | Cross-cutting | Critical |
| Button codes manually synced | Cross-cutting | High |
| Binary format has no machine-readable schema | Cross-cutting | High |
| No CI/CD pipeline | Project | High |
| No input handling architecture | Firmware | High |
| God Component (App.svelte) | Configurator | High |
| No active-state tracking in firmware | Firmware | High |
| No service layer | Configurator | Medium |
| Weak nominal types for IDs | Configurator | Medium |
| No linting (ESLint) | Configurator | Medium |
| No central validation layer | Configurator | Medium |
| Memory fragmentation from per-string malloc | Firmware | Medium |
| Incomplete sequence GC | Configurator | Medium |
| String-keyed action discrimination | Configurator | Medium |
| No format versioning policy | Cross-cutting | Medium |
| Stubs not tracked as work items | Firmware | Medium |
| Component directory flat / ungrouped | Configurator | Low |
| No undo/redo | Configurator | Low |
| Accessibility issues | Configurator | Low |
| No monorepo tooling | Project | Low |
