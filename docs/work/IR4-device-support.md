# Device Support

**Goal:** Introduce a device model that lets users build a library of named devices (IR, REST, and eventually Matter), each with a set of named functions. Each function holds an `ActionTemplate` — a prototype that describes how to produce a concrete `Action` at assignment time. Device definitions are stored in the configurator metadata section of `remote.bin` and are ignored by the firmware. When a user assigns a device function to a button, the template is **materialized** into a concrete `Action` which is then written into the operational section of the config.

This ticket covers the data model, metadata binary encoding, device catalog, and the device library UI (device list and discovery dialog). Creating and editing individual devices and their functions is covered in IR6. The button assignment picker (using devices when assigning actions to buttons) is covered in IR5.

---

## Terminology

| Term | Definition |
|---|---|
| **Device** | A named entity (e.g. "Living Room TV") with a manufacturer, protocol type, and a library of named functions. |
| **DeviceFunction** | A named capability of a device (e.g. "Volume Up") that holds an `ActionTemplate`. |
| **ActionTemplate** | A prototype describing how to produce a concrete `Action`. For IR this is trivially the code itself; for other types it may include template parameters and references to auxiliary resources (e.g. a REST URL that can't fit in 4 bytes). |
| **Materialization** | The process of converting an `ActionTemplate` into a concrete `Action` (and any auxiliary resources required). May be automatic (IR) or interactive if the template has user-supplied parameters (future REST). |
| **Device library** | The full set of Device definitions stored in the configurator metadata section of `remote.bin`. |
| **SequenceAnnotation** | Configurator metadata attached to a Sequence: a user-visible name and an optional reference back to the DeviceFunction it was created from. |
| **Device catalog** | A searchable collection of pre-defined `Device` records available to add to the library. Currently a hardcoded file in the repo; future sources (online registries, third-party databases) pass through a conversion layer to produce the same format. |
| **CatalogSource** | An interface that provides catalog search. The hardcoded source reads a local file; future sources may fetch from a URL. |
| **IRCode** | An operational resource record storing an IR protocol + code pair. Lives in the `irCodes` pool on `RemoteConfig`. The firmware reads this pool; `ir_send` Actions reference entries by ID. |

---

## TypeScript Model

**New additions to** `source/configurator/src/model/actions.ts`:

```typescript
// Template parameter descriptor — used by ActionTemplates that require user input at materialization time
export interface TemplateParameter {
    name: string;       // identifier used in template substitution
    label: string;      // display label shown in the UI
    defaultValue?: string;
}

// IRProtocol enumerates the supported IR signal protocols.
// Values align with the decode_type_t enum from IRremoteESP8266.
// The full list of supported protocols is defined in the firmware spec.
export type IRProtocol = 'nec' | 'sony' | 'rc5' | 'samsung' | 'raw'; // non-exhaustive, extend as needed

export type IRCodeId = number; // uint16

// Operational resource — lives in RemoteConfig.irCodes, referenced by ir_send Actions.
// IRremoteESP8266 uses uint64_t for all protocol codes. Most consumer protocols fit
// in 32 bits, but the field is typed as bigint to cover the full range if needed.
export interface IRCode {
    id: IRCodeId;
    protocol: IRProtocol;
    code: bigint; // uint64 — matches IRremoteESP8266's internal representation
}

// ActionTemplate is a configurator-side prototype, not a runtime value.
export type ActionTemplate =
    | { type: 'ir_send'; protocol: IRProtocol; code: number }
    | { type: 'rest_call'; method: string; url: string; body?: string; parameters?: TemplateParameter[] }; // deferred — REST not yet supported

export interface SequenceAnnotation {
    sequenceId: SequenceId;
    name: string;
    source?: {
        deviceId: DeviceId;
        functionName: string;
    };
}
```

**New file:** `source/configurator/src/model/devices.ts`

```typescript
export type DeviceId = string; // UUID

export type DeviceType = 'ir' | 'rest'; // 'matter' reserved for future

export interface DeviceFunction {
    name: string;
    template: ActionTemplate; // from actions.ts
}

export interface Device {
    id: DeviceId;
    name: string;
    manufacturer: string;
    type: DeviceType;
    functions: DeviceFunction[];
}
```

**Updated** `RemoteConfig` in `source/configurator/src/model/state.ts`:

```typescript
export interface ConfiguratorMetadata {
    devices: Device[];
    sequenceAnnotations: SequenceAnnotation[];
}

export interface RemoteConfig {
    rootStateId: StateId;
    states: State[];
    sequences: Sequence[];
    irCodes: IRCode[];              // new operational pool — firmware reads this
    metadata: ConfiguratorMetadata; // new configurator-only blob
}
```

The `ir_send` Action params change from `params[0..3] = raw code (uint32)` to `params[0..1] = IRCodeId (uint16), params[2..3] = unused`. This is a binary format change that must be reflected in `docs/config-data-model.md` and the firmware.

---

## Device Catalog

### Data Format

The catalog is a `Device[]`. Catalog entries use the same `Device` type as the library — stable IDs (slugs or UUIDs assigned at authoring time) allow the configurator to detect whether a catalog entry is already installed.

**Hardcoded source location:** `source/configurator/src/catalog/devices.json`

This file is the fake list for now. Its structure is a plain JSON array of `Device` objects. It ships with the configurator and requires no network access.

### CatalogSource Interface

All catalog sources implement a common interface so that future sources (online registries, LIRC databases, etc.) can be swapped in without changing the UI:

```typescript
interface CatalogSource {
    search(query: string): Promise<Device[]>;
}

// Current implementation — reads devices.json synchronously, filters in memory
class HardcodedCatalogSource implements CatalogSource { ... }
```

### Conversion Layer

External sources will not produce `Device[]` natively. Each external source gets a converter that maps its format to `Device[]`. The UI and the rest of the configurator only ever deal with the internal format.

```typescript
interface CatalogConverter<TExternal> {
    convert(external: TExternal): Device[];
}
```

This is out of scope for IR4 — noted here so the `CatalogSource` interface is designed with it in mind.

---

## Materialization

Materialization is the step that converts an `ActionTemplate` into a concrete `Action` for inclusion in a `Sequence`. It is triggered when the user assigns a device function to a button (covered in IR5).

**IR (`ir_send`):** Automatic, no user input required. The configurator checks whether an `IRCode` with the same `protocol` + `code` pair already exists in `RemoteConfig.irCodes`. If a match is found its ID is reused; otherwise a new `IRCode` entry is added to the pool and a new ID is assigned. The resulting `ir_send` Action stores the `IRCodeId` in `params[0..1]`.

**REST (`rest_call`):** Deferred — REST devices are not supported yet. The resource pool design needed to materialize REST templates will be addressed when REST support is planned.

The materialization function signature (indicative, not final):

```typescript
// Mutates config to add any new resources, returns the concrete Action to add to the Sequence.
// `params` is reserved for future template parameter substitution (e.g. REST body templates).
function materialize(
    template: ActionTemplate,
    config: RemoteConfig,
    params?: Record<string, string>
): Action;
```

---

## Behaviour Rules

- When a user assigns a DeviceFunction to a button, its `ActionTemplate` is materialized into a concrete `Action` which is written into a new anonymous `Sequence`. The device is not referenced at runtime.
- A `SequenceAnnotation` with a `source` field is created to record which device function the sequence came from. This is informational only — the configurator may display "Samsung TV: Volume Up" in the inspector, but the materialized `Action` is always authoritative.
- Single-action sequences created from a device function are never named or reusable.
- Editing a function's `ActionTemplate` after it has been used does not update previously materialized sequences. The copies are authoritative.
- Deleting a Device from the library does not affect existing sequences. Annotations with a `source` pointing to the deleted device become orphaned; the configurator degrades gracefully (shows the raw action value instead of the device label).

---

## Binary Encoding — Metadata Section

The metadata section is a new section type in `remote.bin`. The firmware does not read it; the configurator reads and writes it on every save.

### Format

The section payload is a **deflate-compressed JSON blob**. Raw `deflate` is used (not gzip) — no gzip header/footer overhead is needed since both ends are controlled by the configurator.

Compression uses the browser-native [Web Compression Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Compression_Streams_API) (`CompressionStream` / `DecompressionStream` with `deflate-raw`). No external library required.

### Section Layout

```
[1 byte]  section type = METADATA
[4 bytes] compressed payload length (uint32 little-endian)
[N bytes] deflate-compressed JSON payload
```

The compressed length is stored so the reader knows exactly how many bytes to consume. Uncompressed size is not stored — the decompressor expands dynamically.

### JSON Structure

The JSON root matches `ConfiguratorMetadata` with an added `version` field for forward compatibility:

```json
{
    "version": 1,
    "devices": [ ... ],
    "sequenceAnnotations": [ ... ]
}
```

The `version` field allows future schema changes to be detected and handled without a separate binary format version bump. Unknown top-level keys must be preserved on round-trip (read → edit → write) so that future fields added by newer configurator versions are not silently dropped by older ones.

> **Open question:** Should unknown keys be actively preserved on round-trip, or is silent dropping acceptable? Preserving requires passing unknown keys through without parsing them (e.g. storing the raw parsed object and only touching known keys).

---

## IRCode Pool Binary Format

The `irCodes` pool is a new **operational section** in `remote.bin` — the firmware reads it, so it lives alongside States and Sequences, not in the metadata blob.

### Section Layout

```
[1 byte]  section type = IR_CODES
[2 bytes] entry count (uint16 little-endian)
[N bytes] repeated IRCode records (variable length, self-describing)
```

### IRCode Record

Each record is self-describing: the protocol tag determines how many bytes follow, so no separate length or bit-width field is needed.

```
[2 bytes] IRCodeId (uint16 little-endian)
[1 byte]  protocol tag (see table below)
[N bytes] protocol-specific code data
```

IR handling is implemented using [IRremoteESP8266](https://github.com/crankyoldgit/IRremoteESP8266). Protocol tags in the binary correspond to the library's `decode_type_t` enum values. The authoritative protocol list and tag assignments live in the firmware spec.

| Protocol | Tag | Code bytes | Notes |
|----------|-----|-----------|-------|
| NEC      | 0x01 | 8 (uint64) | |
| Sony     | 0x02 | 8 (uint64) | SIRC; bit width (12/15/20) implied by protocol |
| RC5      | 0x03 | 8 (uint64) | |
| Samsung  | 0x04 | 8 (uint64) | |
| Raw      | 0x05 | 2 + N      | 2-byte pulse count (uint16) then N bytes of raw pulse data |

All fixed-protocol codes are stored as 8 bytes (uint64 little-endian) to uniformly match IRremoteESP8266's `uint64_t` representation. The serializer writes 8 bytes regardless of the protocol's natural bit width; unused high bytes are zero.

---

## Device Library UI

### Location

The device library is global to the remote config (not scoped to a state), so it lives outside the state editor.

> **Open question:** Where does the device library live? Options: a top-level tab/nav item alongside the state list; a settings/gear panel; a slide-out drawer accessible from the button assignment picker only.

### Device List

The device library view shows all installed devices. Each entry displays the device name, manufacturer, and type badge (IR / REST). From this view the user can:

- Open the device discovery dialog (to browse the catalog and install/remove devices)
- Select a device to view its details (read-only)
- Remove a device directly from the list

Devices sourced from the catalog are read-only — their fields and functions cannot be edited in this ticket. Custom device creation and editing downloaded devices are deferred to IR6.

Removing a device that has functions referenced by existing sequence annotations shows a warning (sequences are unaffected, but source annotations become orphaned).

### Device Detail View (Read-Only)

Selecting a device from the list opens a read-only view showing:

- Name, manufacturer, type
- The full list of functions with a template summary per function (e.g. `IR 0xE0E0E01F`)

No editing controls are shown. This view exists so the user can inspect what functions a device provides before assigning them to buttons.

### Device Discovery Dialog

A modal dialog for browsing the catalog and managing which devices are installed. Opened from a button in the device list.

The dialog has two tabs:

**Browse tab**
- Search bar that filters the catalog by name, manufacturer, or type as the user types
- Results list — each entry shows: device name, manufacturer, type badge, function count
- Devices already installed show an "Added" indicator instead of an add button
- Clicking add installs the device into the library immediately (no confirmation needed)
- Clicking an entry opens the device detail view

**Installed tab**
- Search bar that filters the installed library
- Same entry format as Browse — each entry shows name, manufacturer, type badge, function count
- Each entry has a remove button with a warning if the device has been used in button assignments
- Clicking an entry opens the device detail view

Custom device creation and editing are out of scope for this ticket — see IR6.

---

## Open Questions

1. ~~**Metadata encoding format**~~ — **resolved:** deflate-compressed JSON blob; see Binary Encoding section.
2. ~~**Auxiliary resource pool (REST)**~~ — **deferred:** REST devices are not supported yet; this will be designed when REST support is planned.
3. ~~**IR protocol enumeration**~~ — **resolved:** see IRCode Pool Binary Format section. Supporting NEC, Sony, RC5, Samsung, Raw. Bit-length is implied by protocol tag (no separate field). Pool records are self-describing: protocol tag first, followed by however many bytes that protocol requires.
4. ~~**REST template fields**~~ — **deferred** with REST support.
5. ~~**Unknown key preservation on round-trip**~~ — **resolved:** preserve unknown top-level JSON keys on round-trip. Pass the raw parsed object through and only touch known keys. Niche case, minimal implementation cost.
6. ~~**Online device registry**~~ — **resolved:** the `CatalogSource` interface is already async (`Promise<Device[]>`), so a future HTTP-backed implementation slots in without model changes.
7. ~~**Device deduplication on install**~~ — **resolved:** duplicate detection is based on catalog device ID plus installed parameter values. Non-parameterized devices: block if the same ID is already installed. Parameterized devices (future): allow a second install only if at least one parameter value differs from all existing installs of the same ID — two installs with identical parameters are a duplicate. For now, since no parameterized devices exist, simply block duplicate IDs.
8. ~~**Device library location**~~ — **resolved:** the specific location in the configurator nav is left to implementation. The requirement is that it must be accessible from the main UI — where exactly is deferred.
