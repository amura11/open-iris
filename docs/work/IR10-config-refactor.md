# IR10: Config Refactor — Relational Action Model

**Goal:** Restructure the remote config around a relational model. Devices and their functions become first-class binary sections. Actions reference device functions by ID instead of embedding type-specific data inline. The binary format gains a proper two-level index. Firmware data models and a loading skeleton are introduced.

Supersedes IR9 (power management model is absorbed here).
Informs IR6, IR7, IR8 (each must be updated before implementation; see Impact section).

---

## Background

Three problems motivate this refactor:

**Actions embed type.** Every `Action` today carries a `type` byte (`ir_send`, `navigate`, etc.) and four raw param bytes. Adding a new device protocol means adding a new action type; understanding what a button does requires reconstructing context from raw bytes. Actions should be *references*, not data.

**IR codes are a hidden join.** When the user assigns "Samsung TV → Volume Up" to a button, the configurator materializes an `IRCode` into a global pool and stores the pool ID in the action. To display the assignment, the reader walks back through the pool to match the code to a device function. `SequenceAnnotation` exists only to paper over this round-trip. Under the new model, an action directly references the device and function — no materialization, no annotation, no reverse lookup.

**Firmware has no model.** The config component is a stub. This IR establishes the C data types and loading skeleton the firmware needs to run actions against a config file.

---

## Terminology

| Term | Definition |
|---|---|
| **Device** | A controllable appliance (TV, amplifier, light). First-class in both the binary and the model. |
| **Function** | A named capability of a device (e.g. "Volume Up"). Lives in a flat global pool; referenced by ID. |
| **Function data** | The type-specific payload of a function (IR bytes for `ir` devices; URL+method for `rest`). Stored as a blob in the FUNCTIONS section; interpreted by the device-type runner. |
| **Action** | A reference: `deviceId + functionId + data`. Six bytes. All actions have this shape. |
| **System function** | A function whose `deviceId` is `0xFFFF`. The `functionId` identifies which system operation to run (navigate, pause, power-off-active). No device record exists for `0xFFFF`; the firmware handles it as a special case. |
| **Inline action** | A button assignment that embeds one action directly on the button config, without a wrapping sequence. |
| **DataBlock** | A typed data blob stored in its own section. Referenced by a `DataBlockId`. Used by REST functions for per-button parameter sets; unused for IR and system functions. |
| **SequenceMetadata** | Configurator-only name record for a user-named sequence. Replaces `SequenceAnnotation`. |
| **DeviceMetadata** | Configurator-only record for a device: manufacturer, description, catalog source ID. |
| **FunctionMetadata** | Configurator-only record for a function: source ID used for catalog reconciliation. |
| **RemoteMetadata** | The compressed JSON blob in the binary. Contains device/function/sequence metadata. |

---

## Model Changes (TypeScript)

### New types

```ts
// ── IDs ───────────────────────────────────────────────────────────────────────

export type DeviceId     = number;   // uint16; was string
export type FunctionId   = number;   // uint16; unique within the functions section
export type DataBlockId  = number;   // uint16; unique within the data blocks section

// ── Action ───────────────────────────────────────────────────────────────────

export interface Action {
    deviceId:   DeviceId;
    functionId: FunctionId;
    data:       number;     // uint16; inline value or DataBlockId; 0xFFFF if unused
}

// ── Function data ─────────────────────────────────────────────────────────────

export type FunctionData =
    | { type: 'ir';   protocol: IRProtocol; code: bigint }
    | { type: 'rest'; method: string; url: string; body?: string };  // deferred

// ── Device function ───────────────────────────────────────────────────────────

export interface DeviceFunction {
    id:       FunctionId;
    deviceId: DeviceId;
    name:     string;
    data:     FunctionData;
}

// ── Device ────────────────────────────────────────────────────────────────────

export type DeviceType      = 'ir' | 'rest' | 'matter';
export type DevicePowerMode = 'none' | 'toggle' | 'discrete';

export interface Device {
    id:                  DeviceId;
    name:                string;
    type:                DeviceType;
    powerMode:           DevicePowerMode;    // 'none' if not configured
    powerOnFunctionId?:  FunctionId;         // required when powerMode !== 'none'
    powerOffFunctionId?: FunctionId;         // required when powerMode === 'discrete'
}

// ── Metadata (configurator-only) ──────────────────────────────────────────────

export interface SequenceMetadata {
    sequenceId: SequenceId;
    name?:      string;
}

export interface DeviceMetadata {
    id:           DeviceId;
    manufacturer: string;
    description?: string;
    sourceId?:    string;   // catalog origin; used for update reconciliation
}

export interface FunctionMetadata {
    id:        FunctionId;
    sourceId?: string;      // e.g. IR code hex, or hash of REST params
}

export interface IdCounters {
    device:    number;   // next DeviceId to assign
    function:  number;   // next FunctionId to assign
    sequence:  number;   // next SequenceId to assign
    state:     number;   // next StateId to assign
    dataBlock: number;   // next DataBlockId to assign
}

export interface RemoteMetadata {
    idCounters:       IdCounters;
    deviceMetadata:   DeviceMetadata[];
    functionMetadata: FunctionMetadata[];
    sequenceMetadata: SequenceMetadata[];
    extra:            JsonObject;
}

// ── Data block ────────────────────────────────────────────────────────────────

export interface DataBlock {
    id:   DataBlockId;
    data: Uint8Array;   // opaque; interpreted by the function's device type
}
```

### ID allocation

Each entity type maintains its own monotonically increasing counter in `RemoteMetadata.idCounters`. The counter is the next ID to assign — it only ever increases, even when records are deleted, so IDs are never reused.

```ts
export function nextId(config: RemoteConfig, counter: keyof IdCounters): number {
    return config.metadata.idCounters[counter];
}

export function consumeId(config: RemoteConfig, counter: keyof IdCounters): [number, RemoteConfig] {
    const id = config.metadata.idCounters[counter];
    return [id, {
        ...config,
        metadata: {
            ...config.metadata,
            idCounters: { ...config.metadata.idCounters, [counter]: id + 1 },
        },
    }];
}
```

Callers allocate an ID and update the config in one step:

```ts
const [newDeviceId, updatedConfig] = consumeId(config, 'device');
```

The existing `nextSequenceId` helper in `assignment-utils.ts` is replaced by `consumeId(config, 'sequence')`. A fresh config is initialised with all counters at `0`; the root state is created with ID `0` and the state counter advances to `1`.

### Changed types

**`RemoteConfig`**

```ts
export interface RemoteConfig {
    rootStateId: StateId;
    states:      State[];
    sequences:   Sequence[];
    devices:     Device[];          // promoted from metadata
    functions:   DeviceFunction[];  // new flat pool
    dataBlocks:  DataBlock[];       // new; empty for IR-only configs
    metadata:    RemoteMetadata;    // replaces ConfiguratorMetadata
}
```

**`PhysicalButtonConfig`**

Button assignments are expressed directly on each config type as a discriminated union — there is no standalone `ButtonAssignment` type.

```ts
export interface PhysicalButtonConfig {
    buttonCode: ButtonCode;
    // was: sequenceId: SequenceId
    assignment:
        | { kind: 'sequence'; sequenceId: SequenceId }
        | { kind: 'action';   deviceId: DeviceId; functionId: FunctionId; data: number };
}
```

**`ScreenButtonConfig`**

```ts
export interface ScreenButtonConfig {
    id:    ScreenButtonId;
    label: string;
    icon?: string;
    // was: sequenceId: SequenceId; null = unassigned
    assignment:
        | { kind: 'sequence'; sequenceId: SequenceId }
        | { kind: 'action';   deviceId: DeviceId; functionId: FunctionId; data: number }
        | null;
}
```

**`ActionPickerSelection`** — adds `power_off_active`

```ts
export type ActionPickerSelection =
    | { kind: 'device';          device: Device; deviceFunction: DeviceFunction }
    | { kind: 'navigate';        targetStateId: number }
    | { kind: 'pause';           durationMs: number }
    | { kind: 'power_off_active' };
```

**`Sequence`** — shape unchanged; `Action` members now have the new action shape.

**`State`** — gains `activeDevices` (absorbed from IR9)

```ts
export interface State {
    id:             StateId;
    name:           string;
    stateType:      StateType;
    screenButtons:  ScreenButtonConfig[];
    physicalButtons: PhysicalButtonConfig[];
    onActivate:     SequenceId | null;
    onDeactivate:   SequenceId | null;
    buttonFallback: boolean;
    activeDevices:  DeviceId[];   // new; empty for non-persistent states
}
```

### Removed types

| Removed | Replacement |
|---------|-------------|
| `IRCode`, `IRCodeId` | IR data lives in `DeviceFunction.data` |
| `ActionType`, `ACTION_TYPE_BYTE`, `BYTE_TO_ACTION_TYPE` | Device type determines dispatch; no action type field |
| `ActionTemplate` | `FunctionData` |
| `SequenceAnnotation` | `SequenceMetadata` |
| `ConfiguratorMetadata` | `RemoteMetadata` |

### New constants in `serialization.ts`

```ts
export const VERSION = 0x05;   // bumped; breaking change

export const TYPE_DEVICES     = 0x03;   // replaces TYPE_IR_CODES
export const TYPE_FUNCTIONS   = 0x04;
export const TYPE_DATA_BLOCKS = 0x05;

export const SYSTEM_DEVICE_ID          = 0xFFFF;
export const SYSTEM_FN_NAVIGATE        = 0x0001;
export const SYSTEM_FN_PAUSE           = 0x0002;
export const SYSTEM_FN_POWER_OFF_ACTIVE = 0x0003;

export const ASSIGNMENT_NONE     = 0x00;
export const ASSIGNMENT_SEQUENCE = 0x01;
export const ASSIGNMENT_ACTION   = 0x02;

export const DEVICE_TYPE_BYTE: Record<DeviceType, number> = {
    ir:     0x01,
    rest:   0x02,
    matter: 0x03,
};

export const POWER_MODE_BYTE: Record<DevicePowerMode, number> = {
    none:     0x00,
    toggle:   0x01,
    discrete: 0x02,
};

export const IR_PROTOCOL_BYTE: Record<IRProtocol, number> = { /* unchanged */ };
```

### Changes to `assignment-utils.ts`

**`selectionToAction`** — replaces `materialize`. No IR code pool to manage.

```ts
export function selectionToAction(sel: ActionPickerSelection): Action {
    if (sel.kind === 'device')
        return { deviceId: sel.device.id, functionId: sel.deviceFunction.id, data: IRIS_NO_ID };
    if (sel.kind === 'navigate')
        return { deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_NAVIGATE,         data: sel.targetStateId };
    if (sel.kind === 'pause')
        return { deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_PAUSE,             data: sel.durationMs };
    return     { deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_POWER_OFF_ACTIVE,  data: IRIS_NO_ID };
}
```

**`reconstructSteps`** — direct lookup; no IR code reverse walk.

```ts
export function reconstructSteps(sequence: Sequence, config: RemoteConfig): ActionPickerSelection[] {
    return sequence.actions.flatMap((action): ActionPickerSelection[] => {
        if (action.deviceId === SYSTEM_DEVICE_ID) {
            if (action.functionId === SYSTEM_FN_NAVIGATE)
                return [{ kind: 'navigate', targetStateId: action.data }];
            if (action.functionId === SYSTEM_FN_PAUSE)
                return [{ kind: 'pause', durationMs: action.data }];
            return [{ kind: 'power_off_active' }];
        }
        const device = config.devices.find(d => d.id === action.deviceId);
        const fn     = config.functions.find(f => f.id === action.functionId);
        return device && fn ? [{ kind: 'device', device, deviceFunction: fn }] : [];
    });
}
```

**`assignmentLabel`** — operates on `Action` directly; no annotation lookup.

**`buildSingleActionConfig`** — single-action buttons now produce an inline `{ kind: 'action', ... }` assignment directly on the button config, not a sequence. No `SequenceAnnotation` added. No `irCodes` to update.

**`buildMultiActionConfig`** — creates a sequence as before; adds a `SequenceMetadata` entry if a name is provided.

**`garbageCollect`** — collects orphaned anonymous sequences only. Devices, functions, and params are library items and are never GC'd automatically.

**`materialize.ts`** — deleted. The materialization step no longer exists.

---

## Binary Format (Version 0x05)

### File layout

```
[Header]         7 bytes
[Manifest]       2 + section_count × 11 bytes
[Section data]   variable — ordered as listed in manifest
```

### Header (7 bytes, layout unchanged)

```
magic:          4 bytes   "IRIS" (0x49 0x52 0x49 0x53)
version:        uint8     0x05
root_state_id:  uint16    LE
```

### Manifest

```
section_count:  uint16
entries[]:
    type_tag:     uint8
    count:        uint16    record count (or compressed byte length for METADATA)
    index_offset: uint32    byte offset of the section's record index (0 for blob sections)
    data_offset:  uint32    byte offset of blob data (0 for indexed sections)
```

`MANIFEST_ENTRY_SIZE = 11` (unchanged). `HEADER_SIZE = 7` (unchanged).

### Record index (per indexed section)

Each indexed section (STATES, SEQS, DEVICES, FUNCTIONS, DATA BLOCKS) has a record index immediately following the manifest. Records within each section are sorted ascending by ID.

```
entries[count]:
    id:          uint16
    data_offset: uint32   absolute byte offset of the record's data
    data_length: uint16   byte length of the record's data
```

`INDEX_ENTRY_SIZE = 8` (unchanged).

### Section type tags

| Tag | Section |
|-----|---------|
| 0x01 | STATES |
| 0x02 | SEQS |
| 0x03 | DEVICES |
| 0x04 | FUNCTIONS |
| 0x05 | DATA BLOCKS |
| 0xFF | METADATA |

### DEVICES section (0x03)

One record per device. The system device (0xFFFF) is not written — it is implicit.

```
id:                   uint16
type:                 uint8     0x01=ir  0x02=rest  0x03=matter
power_mode:           uint8     0x00=none  0x01=toggle  0x02=discrete
power_on_fn_id:       uint16    function ID; IRIS_NO_ID if not set
power_off_fn_id:      uint16    function ID; IRIS_NO_ID if not set
name:                 null-terminated UTF-8
```

Fixed prefix: 8 bytes. Total record length = 8 + strlen(name) + 1.

### FUNCTIONS section (0x04)

One record per device function. All functions share one flat pool, sorted by ID.

```
id:          uint16
device_id:   uint16
name:        null-terminated UTF-8
data:        [remaining bytes — type-specific blob]
```

The deserializer reads `id` (2) + `device_id` (2) + `name` (null-terminated), then treats everything remaining up to `data_length` as the function data blob. To interpret the blob, look up the device by `device_id` and branch on its type.

**IR function data blob** (9 bytes):
```
protocol:  uint8    (see IR_PROTOCOL_BYTE table)
code:      uint64   little-endian
```

**REST function data blob** (deferred — define layout when implementing):
```
method:    uint8           0x01=GET  0x02=POST  0x03=PUT  0x04=DELETE
url:       null-terminated UTF-8
body:      null-terminated UTF-8  (empty string if no body)
```

### DATA BLOCKS section (0x05)

One record per data block. Empty for IR-only configs.

```
id:    uint16
data:  [remaining bytes — opaque blob, interpreted by function type]
```

Blob length = `data_length - 2`.

### SEQS section (0x02)

Updated: actions are now 6 bytes each (no type byte).

```
id:            uint16
action_count:  uint8
actions[]:
    device_id:   uint16
    function_id: uint16
    data:        uint16     inline value or DataBlockId; IRIS_NO_ID if unused
```

Record length = 3 + action_count × 6.

### STATES section (0x01)

Updated: button assignments use a discriminated encoding; `activeDevices` added.

**State record header:**
```
id:             uint16
state_type:     uint8     0x00=root  0x01=persistent  0x02=ephemeral
button_fallback: uint8    0x01=true  0x00=false
on_activate:    uint16    sequence ID; IRIS_NO_ID if not set
on_deactivate:  uint16    sequence ID; IRIS_NO_ID if not set
name:           null-terminated UTF-8
```

**Active devices** (follows name):
```
active_device_count:  uint16
active_device_ids:    [count × uint16]
```

**Physical buttons** (follows active devices):
```
phys_button_count:  uint8
phys_buttons[]:     [variable-length records]
```

Each physical button record:
```
button_code:      uint8
assignment_type:  uint8
assignment_data:  [variable]
```

| `assignment_type` | `assignment_data` |
|---|---|
| 0x01 (sequence) | `seq_id(uint16)` |
| 0x02 (inline action) | `device_id(uint16) + function_id(uint16) + data(uint16)` |

Physical buttons are only written if assigned; there is no `0x00` entry for unassigned physical buttons.

**Screen buttons** (follows physical buttons):
```
screen_button_count:  uint16
screen_buttons[]:     [variable-length records]
```

Each screen button record:
```
label:           null-terminated UTF-8
icon_id:         uint16    IRIS_NO_ID if not set
assignment_type: uint8
assignment_data: [variable — same table as physical buttons; 0x00 = unassigned, no data]
```

### METADATA section (0xFF)

Deflate-raw compressed JSON blob. Updated shape (version 2):

```json
{
    "version": 2,
    "idCounters":       { "device": 3, "function": 12, "sequence": 8, "state": 4, "dataBlock": 0 },
    "deviceMetadata":   [{ "id": 1, "manufacturer": "Sony", "description": "...", "sourceId": "..." }],
    "functionMetadata": [{ "id": 1, "sourceId": "0x20DF10EF" }],
    "sequenceMetadata": [{ "sequenceId": 1, "name": "TV Watch Mode" }]
}
```

`sourceId` for IR functions is the hex string of the IR code value. For REST it is a hash of method + url + body. Used by the configurator for catalog update reconciliation; never read by firmware.

---

## Firmware (C)

### Design principles

- **The API is `get_X(id)`; pools handle everything behind it.** Callers do not know how or when records are loaded, where they live, or when they are evicted. The config component owns all memory.
- **Records are always fully parsed before being handed to callers.** Nothing is passed as raw bytes or a "blob pointer." Each entity type has a proper C struct with named, typed fields.
- **Each entity type has its own pool.** A pool holds the section index (always in memory) and a collection of parsed structs. `get_X(id)` asks the pool; the pool handles loading if the record is not present.
- **First implementation: load all records into each pool at startup.** This is the simplest correct behaviour. Later, pool loading strategy (lazy, LRU, prefetch) can be changed without touching any code that calls `get_X`.
- **I/O is abstract.** The config holds a read callback and a context pointer. Initially the callback reads from a heap buffer supplied by the caller (useful for testing). Later it reads from SPIFFS or SD. Nothing outside the config component changes.
- **Section indexes live in memory permanently.** They are tiny (8 bytes per entry) and needed for every pool lookup. They are populated during `iris_config_load` and never evicted.

### Type definitions (`config.h`)

```c
#pragma once

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"

// ── Sentinel ──────────────────────────────────────────────────────────────────

#define IRIS_NO_ID  UINT16_MAX   // 0xFFFF — "not set" for any uint16 ID

// ── System functions — device ID 0xFFFF means system; function ID selects which ──

#define IRIS_SYSTEM_DEVICE_ID         UINT16_MAX   // 0xFFFF
#define IRIS_SYS_FN_NAVIGATE          0x0001
#define IRIS_SYS_FN_PAUSE             0x0002
#define IRIS_SYS_FN_POWER_OFF_ACTIVE  0x0003

// ── Type aliases ──────────────────────────────────────────────────────────────

typedef uint16_t iris_device_id_t;
typedef uint16_t iris_function_id_t;
typedef uint16_t iris_sequence_id_t;
typedef uint16_t iris_state_id_t;
typedef uint16_t iris_params_id_t;

// ── Enumerations ──────────────────────────────────────────────────────────────

typedef enum {
    IRIS_DEVICE_TYPE_IR     = 0x01,
    IRIS_DEVICE_TYPE_REST   = 0x02,
    IRIS_DEVICE_TYPE_MATTER = 0x03,
} iris_device_type_t;

typedef enum {
    IRIS_POWER_MODE_NONE     = 0x00,
    IRIS_POWER_MODE_TOGGLE   = 0x01,
    IRIS_POWER_MODE_DISCRETE = 0x02,
} iris_power_mode_t;

typedef enum {
    IRIS_ASSIGN_UNASSIGNED = 0x00,   // only valid for screen buttons
    IRIS_ASSIGN_SEQUENCE   = 0x01,
    IRIS_ASSIGN_ACTION     = 0x02,
} iris_assignment_type_t;

typedef enum {
    IRIS_STATE_ROOT       = 0x00,
    IRIS_STATE_PERSISTENT = 0x01,
    IRIS_STATE_EPHEMERAL  = 0x02,
} iris_state_type_t;

// ── Action (6 bytes, packed) ──────────────────────────────────────────────────

typedef struct __attribute__((packed)) {
    iris_device_id_t    device_id;
    iris_function_id_t  function_id;
    uint16_t            data;        // inline value or DataBlockId; IRIS_NO_ID if unused
} iris_action_t;

// ── Device (always-loaded record) ─────────────────────────────────────────────

typedef struct {
    iris_device_id_t    id;
    iris_device_type_t  type;
    iris_power_mode_t   power_mode;
    iris_function_id_t  power_on_fn;    // IRIS_NO_ID if not set
    iris_function_id_t  power_off_fn;   // IRIS_NO_ID if not set
    char               *name;           // heap-allocated, null-terminated
} iris_device_t;

// ── Parsed function data (one variant per device type) ───────────────────────

typedef struct {
    uint8_t   protocol;   // IRIS_IR_PROTOCOL_* byte
    uint64_t  code;       // parsed little-endian uint64
} iris_ir_data_t;

typedef struct {
    uint8_t  method;      // 0x01=GET 0x02=POST 0x03=PUT 0x04=DELETE
    char    *url;         // heap-allocated, null-terminated
    char    *body;        // heap-allocated, null-terminated; NULL if empty
} iris_rest_data_t;

// ── Parsed function ────────────────────────────────────────────────────────────

typedef struct {
    iris_function_id_t  id;
    iris_device_id_t    device_id;
    iris_device_type_t  device_type;   // duplicated from device for dispatch without lookup
    char               *name;          // heap-allocated, null-terminated
    union {
        iris_ir_data_t   ir;
        iris_rest_data_t rest;
    } data;
} iris_function_t;

// ── Parsed sequence ────────────────────────────────────────────────────────────

typedef struct {
    iris_sequence_id_t  id;
    uint8_t             count;
    iris_action_t      *actions;   // heap-allocated array of parsed action structs
} iris_sequence_t;

// ── Loaded button configs ─────────────────────────────────────────────────────

typedef struct {
    uint8_t                button_code;
    iris_assignment_type_t assignment_type;
    union {
        iris_sequence_id_t sequence_id;
        iris_action_t      action;
    };
} iris_phys_button_t;

typedef struct {
    char                  *label;            // heap-allocated, null-terminated
    uint16_t               icon_id;          // IRIS_NO_ID if not set
    iris_assignment_type_t assignment_type;  // IRIS_ASSIGN_UNASSIGNED if not configured
    union {
        iris_sequence_id_t sequence_id;
        iris_action_t      action;
    };
} iris_screen_button_t;

// ── Loaded state ──────────────────────────────────────────────────────────────

typedef struct {
    iris_state_id_t       id;
    iris_state_type_t     state_type;
    bool                  button_fallback;
    iris_sequence_id_t    on_activate;     // IRIS_NO_ID if not set
    iris_sequence_id_t    on_deactivate;   // IRIS_NO_ID if not set
    char                 *name;            // heap-allocated, null-terminated
    uint16_t              active_device_count;
    iris_device_id_t     *active_devices;  // heap-allocated array
    uint8_t               phys_count;
    iris_phys_button_t   *phys_buttons;    // heap-allocated array
    uint16_t              screen_count;
    iris_screen_button_t *screen_buttons;  // heap-allocated array
} iris_state_t;

// ── Abstract I/O ─────────────────────────────────────────────────────────────
// Read `length` bytes from absolute byte offset `offset` into `buf`.
// The context pointer is supplied by the caller of iris_config_load_*.

typedef esp_err_t (*iris_read_fn_t)(void *ctx, uint32_t offset, uint8_t *buf, uint16_t length);

// ── Section index (fully loaded into memory at config load time) ──────────────

typedef struct {
    uint16_t  id;
    uint32_t  data_offset;   // absolute byte offset in the source
    uint16_t  data_length;
} iris_index_entry_t;        // 8 bytes — matches INDEX_ENTRY_SIZE in the binary format

typedef struct {
    iris_index_entry_t *entries;   // heap-allocated; sorted ascending by id
    uint16_t            count;
} iris_section_index_t;

// ── Main config ───────────────────────────────────────────────────────────────

typedef struct {
    iris_state_id_t       root_state_id;
    // Abstract I/O — the only way records are read from source
    iris_read_fn_t        read;
    void                 *read_ctx;
    // Section indexes — always in memory; populated during load
    iris_section_index_t  state_idx;
    iris_section_index_t  seq_idx;
    iris_section_index_t  fn_idx;
    iris_section_index_t  data_blocks_idx;
    // Parsed pools — populated by the pool loading strategy (first impl: all at startup)
    iris_device_t        *device_pool;
    uint16_t              device_count;
    iris_function_t      *function_pool;
    uint16_t              function_count;
    iris_sequence_t      *sequence_pool;
    uint16_t              sequence_count;
    iris_state_t         *state_pool;
    uint16_t              state_count;
} iris_config_t;
```

### Public API (`config.h`)

```c
// ── Loading ───────────────────────────────────────────────────────────────────

// Initialise config from an arbitrary read source. Populates all pools according
// to the current loading strategy (first impl: all records loaded immediately).
// read and read_ctx must remain valid for the lifetime of the config.
esp_err_t iris_config_load(iris_read_fn_t read, void *read_ctx, iris_config_t *out);

// Convenience: initialise with a buffer-backed read function (useful for testing).
esp_err_t iris_config_load_buffer(const uint8_t *buf, size_t len, iris_config_t *out);

// Free all heap memory owned by the config. Does not close the read source.
void iris_config_free(iris_config_t *config);

// ── Getters — pool management is internal; NULL means not found ───────────────

const iris_device_t   *iris_config_get_device (iris_config_t *config, iris_device_id_t   id);
const iris_function_t *iris_config_get_fn     (iris_config_t *config, iris_function_id_t id);
const iris_sequence_t *iris_config_get_seq    (iris_config_t *config, iris_sequence_id_t id);
const iris_state_t    *iris_config_get_state  (iris_config_t *config, iris_state_id_t    id);

// ── Action execution ──────────────────────────────────────────────────────────

esp_err_t iris_run_action       (iris_config_t *config, const iris_action_t        *action);
esp_err_t iris_run_sequence     (iris_config_t *config, iris_sequence_id_t          seq_id);
esp_err_t iris_run_phys_button  (iris_config_t *config, const iris_phys_button_t   *btn);
esp_err_t iris_run_screen_button(iris_config_t *config, const iris_screen_button_t *btn);
```

### Implementation notes (`config.c`)

**`iris_config_load`** sequence:
1. Call `read` to fetch the 7-byte header. Validate magic and version.
2. Read `root_state_id` and `section_count`. Read all manifest entries.
3. For each indexed section, read its index entries from source into a heap-allocated `iris_index_entry_t` array and store in the corresponding `iris_section_index_t`.
4. Populate all pools by iterating each section's index and parsing every record (first impl). Parsing is per-section — see below.

**Pool population — devices:** For each entry in the DEVICES section index, read the record bytes using `read`. Parse the fixed fields and the null-terminated name string. Store the parsed `iris_device_t` in `device_pool`.

**Pool population — functions:** For each entry in `fn_idx`, read the record bytes. Parse `id`, `device_id`, heap-copy `name`. Look up the device in `device_pool` to get `device_type`; store it in `function.device_type`. Then parse the type-specific data blob into the appropriate union member (`function.data.ir` or `function.data.rest`).

**Pool population — sequences:** For each entry in `seq_idx`, read the record bytes. Parse `id` and `count`. Heap-allocate `actions` array and parse each `iris_action_t` (6 bytes each, little-endian fields).

**Pool population — states:** For each entry in `state_idx`, read the record bytes. Parse fixed header fields. Heap-copy name string. Parse `active_devices` array. Parse physical and screen button records using the discriminated assignment encoding.

**`iris_config_get_*`** — linear or binary search of the appropriate pool array by ID. Returns a pointer into the pool; valid while config is alive.

**Index binary search helper** (used during pool population):
```c
// Binary search entries[] for id. Returns pointer to matching entry or NULL.
static const iris_index_entry_t *index_find(const iris_section_index_t *idx, uint16_t id);
```

Records are sorted ascending by ID (enforced by the serializer), so binary search is correct.

**`iris_run_action`** — dispatch via the parsed function:
```c
esp_err_t iris_run_action(iris_config_t *config, const iris_action_t *action)
{
    if (action->device_id == IRIS_SYSTEM_DEVICE_ID)
        return iris_run_system_fn(config, action->function_id, action->data);

    const iris_function_t *fn = iris_config_get_fn(config, action->function_id);
    if (!fn) return ESP_ERR_NOT_FOUND;

    switch (fn->device_type) {
        case IRIS_DEVICE_TYPE_IR:   return iris_run_ir_fn  (&fn->data.ir,   action->data);
        case IRIS_DEVICE_TYPE_REST: return iris_run_rest_fn(&fn->data.rest, action->data);
        default:                    return ESP_ERR_NOT_SUPPORTED;
    }
}
```

No device lookup needed for dispatch — `device_type` is stored on the parsed function.

**`iris_run_system_fn`** — switch on `function_id`:
- `IRIS_SYS_FN_NAVIGATE` → `data` is the target state ID; stub with `ESP_LOGI`.
- `IRIS_SYS_FN_PAUSE` → `data` is duration ms; stub with `vTaskDelay`.
- `IRIS_SYS_FN_POWER_OFF_ACTIVE` → stub with `ESP_LOGI`.

**`iris_run_ir_fn`** — stub: log `fn->protocol` and `fn->code`; IR hardware send is a separate component.

**`iris_run_rest_fn`** — stub: `ESP_LOGI` + `ESP_ERR_NOT_SUPPORTED`.

### File and component structure

```
source/firmware/components/config/
    CMakeLists.txt
    include/
        config.h        ← all types + full public API
        button_codes.h  ← unchanged
    config.c            ← iris_config_load, iris_config_load_buffer, iris_config_free,
                           index helpers, device/function/state/sequence loaders
    action.c            ← iris_run_action, iris_run_sequence, iris_run_assignment,
                           iris_run_system_action, iris_run_ir_fn (stub), iris_run_rest_fn (stub)
```

---

## Configurator UI Changes

### Action picker

Add **Power off active devices** to the system section of the action picker. Creates a `{ kind: 'power_off_active' }` selection, which maps to `{ deviceId: 0xFFFF, functionId: 0x0003, data: 0xFFFF }`.

### Sequence editor

`reconstructSteps` and `selectionToAction` now work on direct device/function references. No visible change to the sequence editor UI itself.

### Button inspector

`assignmentLabel` now resolves through `config.devices` and `config.functions` by ID. The displayed label for a device function assignment is `"{device.name} → {function.name}"`. System actions continue to display as "Navigate → {state}", "Pause {N}ms", and "Power off active devices".

### Device list / device detail panel

The device model now includes power configuration fields (`powerMode`, `powerOnFunctionId`, `powerOffFunctionId`). The device detail panel should expose these (deferred to IR6 for the full editor; a read-only display is acceptable in this IR).

---

## Impact on Other IRs

| IR | Status after IR10 | Required update |
|----|-------------------|-----------------|
| IR6 | Deferred → Deferred | Device editor model changes to match new `Device` / `DeviceFunction` shapes. Manufacturer moves to `DeviceMetadata`. |
| IR7 | Ready → needs update | `ScreenButtonConfig.sequenceId` → inline discriminated assignment (sequence or inline action). Assignment status indicator reads `assignment !== null`. Selection model unchanged. |
| IR8 | Ready → needs update | Binary inspector must know DEVICES (0x03), FUNCTIONS (0x04), DATA BLOCKS (0x05) sections; IR_CODES (0x03) is gone. Sequence action layout changes to 6 bytes with no type byte. State record gains `activeDevices` block and discriminated button assignments. |
| IR9 | Superseded | `State.activeDevices`, `Device.powerMode/powerOnFunctionId/powerOffFunctionId`, power transition logic, and `power_off_active` are all absorbed into this IR. IR9 is closed. |

---

## Open Questions

1. **IR function caching in firmware.** Function blobs are zero-copy (pointer into raw buffer). A frequently-used function's data is always accessible without loading. Is there any reason to add an explicit cache, or is the raw-buffer pointer sufficient? Current position: no cache needed; raw buffer approach is sufficient.

2. **`iris_config_seq_buf_size` requires an index lookup before allocation.** The caller needs the sequence length to allocate a stack or heap buffer, which requires a first lookup. An alternative is a fixed maximum sequence buffer size (`#define IRIS_MAX_SEQ_BUF`). Decide at implementation time based on ESP heap pressure.

3. **State buffer ownership and the active state.** When the firmware navigates to a new persistent state, the old state should be freed. An ephemeral overlay should not free the underlying persistent state. The state machine that manages this is outside the scope of this IR; `iris_state_free` and `iris_config_load_state` are the building blocks.
