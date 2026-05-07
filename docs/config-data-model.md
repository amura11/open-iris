# Config Data Model

The `remote.bin` file is the contract between the configurator (writer) and the firmware (reader). This document covers the binary format, shared type definitions, and button code registry.

## Status

| Item | State |
|---|---|
| TypeScript model types | Updating (IR3) |
| Binary writer (`writer.ts`) | Updating (IR3) |
| Binary reader (`reader.ts`) | Updating (IR3) |
| C types (`config.h`) | Planned |
| C binary loader | Planned |
| Button codes — TypeScript side | Built |
| Button codes — C side | Planned |

---

## Binary Format (`remote.bin`)

The configurator is the canonical writer. The firmware is a pure reader.

### Design principles

- All resources are identified by stable numeric IDs.
- Each section has a **resource index** — a small, always-loaded table mapping each ID to its location and size in the file. Resources are loaded by seeking to the recorded offset.
- Strings are stored inline in the records that own them as null-terminated UTF-8. There is no separate string section.
- Sections with unknown type tags must be skipped without error.

### Header (7 bytes)

```
magic           4 bytes   "IRIS" (0x49 0x52 0x49 0x53)
version         1 byte    0x03
root_state_id   2 bytes   little-endian uint16
```

The reader must reject files where `version != 0x03`.

### Manifest

```
section_count   2 bytes
Per entry (11 bytes):
  type_tag      1 byte
  count         2 bytes   resource count; or byte length for un-indexed sections
  index_offset  4 bytes   absolute file offset to resource index; 0x00000000 if no index
  data_offset   4 bytes   absolute file offset to data block; 0x00000000 for indexed sections
```

| type_tag | Section | Index | Notes |
|---|---|---|---|
| 0x01 | States | Yes | Variable-length records; screen buttons embedded inline |
| 0x02 | Sequences | Yes | Variable-length records |
| 0x03 | Icons | Yes | JIT loaded; record format TBD |
| 0xFF | Configurator Metadata | No | Firmware must skip entirely without parsing; fixed at 0xFF so future section types remain contiguous |

### Resource index entry (8 bytes)

Used by all indexed sections (States, Sequences, Icons, REST Payloads).

```
id            2 bytes   little-endian uint16
data_offset   4 bytes   absolute file offset to this resource's data
data_length   2 bytes   byte length of this resource's data
```

The index for a section is a flat array of these entries. To resolve a resource by ID: scan (or binary search if sorted) the index for a matching `id`, then read `data_length` bytes from `data_offset`.

The writer should output IDs in ascending order within each index to enable binary search.

### State record (variable length)

```
id                        2 bytes
state_type                1 byte    0x00 = root | 0x01 = persistent | 0x02 = ephemeral
button_fallback           1 byte    0x00 = false | 0x01 = true
on_activate_sequence_id   2 bytes   0xFFFF = not configured
on_deactivate_sequence_id 2 bytes   0xFFFF = not configured
name                      null-terminated UTF-8
physical_button_count     1 byte
Per physical button config (4 bytes, fixed):
  button_code             1 byte    numeric ButtonCode enum value
  _reserved               1 byte    must be 0x00
  sequence_id             2 bytes   little-endian uint16
screen_button_count       2 bytes
Per screen button config (variable):
  label                   null-terminated UTF-8
  icon_id                 2 bytes   0xFFFF = none
  sequence_id             2 bytes   little-endian uint16
```

Fixed-size fields come before all variable-length content. Physical button configs are fixed-size and appear before screen button configs to allow the parser to advance cleanly. Screen buttons are ordered; their position in the record determines display order.

### Sequence record (variable length)

```
id              2 bytes
action_count    1 byte    at least 1
Per action (5 bytes):
  action_type   1 byte
  params        4 bytes   layout determined by action_type; unused bytes are 0x00
```

### Configurator metadata (type_tag 0xFF)

Stores sequence names and any other configurator-only data. The firmware must recognise this tag in the manifest and skip the block without parsing. The block's internal format is owned by the configurator.

```
name_count          2 bytes
Per named sequence:
  sequence_id       2 bytes
  name              null-terminated UTF-8
```

---

## TypeScript Types

Defined in:

| File | Contents |
|---|---|
| `source/configurator/src/model/state.ts` | `State`, `StateId`, `StateType`, `RemoteConfig` |
| `source/configurator/src/model/actions.ts` | `Action`, `ActionType`, `Sequence`, `SequenceId`, `PhysicalButtonConfig`, `ScreenButtonConfig`, `ScreenButtonId` |
| `source/configurator/src/model/button-codes.ts` | `ButtonCode` constants |

---

## C Types

Planned. Defined in `source/firmware/components/config/include/config.h`.

The firmware loading model uses a resource-index-based context rather than a flat struct with raw pointers. See `temp/firmware-config-loading.md` for design notes.

Key types (indicative — not yet implemented):

```c
#define SEQUENCE_ID_NONE  0xFFFF
#define ICON_ID_NONE      0xFFFF

typedef uint16_t state_id_t;
typedef uint16_t sequence_id_t;
typedef uint16_t icon_id_t;
typedef uint8_t  action_type_t;   // values TBD; defined in action_types.h

typedef struct {
    action_type_t type;
    uint8_t       params[4];
} action_t;

typedef struct {
    uint16_t  id;
    uint32_t  data_offset;
    uint16_t  data_length;
} resource_entry_t;

typedef struct {
    resource_entry_t *entries;
    uint16_t          count;
} resource_index_t;
```

`config_ctx_t` holds one `resource_index_t` per indexed section. Resources are resolved through typed accessor functions that check a cache before loading from the file buffer. See `temp/firmware-config-loading.md`.

---

## Button Codes

Button codes are named string constants identifying physical buttons (e.g. `VOL_UP`, `DPAD_CENTER`). Defined in two places, kept in sync manually:

| Side | File | Form |
|---|---|---|
| Configurator | `source/configurator/src/model/button-codes.ts` | TypeScript string constants |
| Firmware | `source/firmware/components/config/include/button_codes.h` | C enum (planned) |

String values are used on the TypeScript side so layout `.toml` files can reference button codes by name. Numeric enum values are used in the binary format.

---

## Deferred

- Icon record format
- ActionType enum values and C header (`action_types.h`)
- Button code enum consolidation (C and TS currently kept in sync manually)
- `config_ctx_t` implementation and binary loader (`config_load()`)
