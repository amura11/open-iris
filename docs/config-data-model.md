# Config Data Model

The `remote.bin` file is the contract between the configurator (writer) and the firmware (reader). This document covers the shared type definitions, binary format, and button code registry.

## Status

| Item | State |
|---|---|
| TypeScript model types | Built |
| Binary writer (`writer.ts`) | Built |
| Binary reader (`reader.ts`) | Built |
| C types (`config.h`) | Planned |
| C binary loader (`config.c`) | Planned |
| Button codes — TypeScript side | Built |
| Button codes — C side | Planned |

## TypeScript Types

Defined in `source/configurator/src/model/context.ts`.

```typescript
export type ItemId    = number;
export type ContextId = number;

export interface Item {
    id: ItemId;
    label: string;
}

export interface Context {
    id: ContextId;
    name: string;
    canActivate: boolean;
    items: Item[];
    onActivateCommands: [];    // Stubbed — will hold command sequences
    onDeactivateCommands: [];
}

export interface RemoteConfig {
    rootContextId: ContextId;
    contexts: Context[];
}
```

## C Types

Defined in `source/firmware/components/config/include/config.h`.

```c
typedef struct { uint16_t id; const char *label; } item_t;

typedef struct {
    uint16_t id;
    bool can_activate;
    const char *name;
    uint16_t item_count;
    item_t *items;
    // Activity-only: on_activate / on_deactivate — stubbed
} context_t;

typedef struct {
    context_t *contexts;
    uint16_t context_count;
    uint16_t root_context_id;
    char *string_blob;     // owns all string memory
    uint8_t *raw_buffer;   // owns the entire loaded file buffer
} config_t;
```

All string pointers (`name`, `label`) point into `string_blob` and are resolved at load time. Callers never deal with offsets after loading.

## Binary Format (`remote.bin`)

The configurator is the canonical writer. The firmware is a pure reader.

```
[Header]          7 bytes
  magic            4 bytes   "IRIS" (0x49 0x52 0x49 0x53)
  version          1 byte    0x01
  root_context_id  2 bytes   little-endian uint16

[Manifest]        variable
  entry_count      2 bytes   (always 3 for current version)
  Per entry (11 bytes each):
    type_tag       1 byte    0x01 = contexts | 0x02 = items | 0x03 = string blob
    count          2 bytes   record count; byte length for the string blob entry
    data_offset    4 bytes   absolute byte offset to the data block
    id_list_offset 4 bytes   absolute offset to ID array (0 if not applicable)

[Data Blocks]     at offsets declared in manifest

  Context record (variable length):
    id             2 bytes
    can_activate   1 byte    0 = false, 1 = true
    name_offset    4 bytes   byte offset into string blob
    item_count     2 bytes
    item_ids       item_count × 2 bytes

  Item record (6 bytes):
    id             2 bytes
    label_offset   4 bytes   byte offset into string blob

  String blob:
    Packed null-terminated UTF-8 strings
    Offsets are uint32_t — blob is not size-limited
    Identical strings are deduplicated (same offset reused)
```

All multi-byte integers are little-endian.

## Button Codes

Button codes are named string constants identifying physical buttons (e.g. `VOL_UP`, `VOL_DOWN`, `MUTE`). They are defined in two places, kept in sync manually:

| Side | File | Form |
|---|---|---|
| Configurator | `source/configurator/src/model/button-codes.ts` | TypeScript string enum |
| Firmware | `source/firmware/components/config/include/button_codes.h` | C enum |

String values are used (not numeric) on the TypeScript side so that layout `.toml` files can reference button codes by name directly, without a lookup table.

## Deferred

- Command sequences on Context (`on_activate` / `on_deactivate` — IR codes, macros)
- Button code enum consolidation (C and TS enums are currently kept in sync manually)
