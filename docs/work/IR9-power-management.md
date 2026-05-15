# Power Management

**Goal:** Introduce device power management for persistent states. States declare which devices must be powered on; the firmware computes what to turn on/off when switching between persistent states and avoids touching devices shared between them. The physical power button can power off everything the system believes is currently on.

Depends on IR4 (device model and metadata). Informs IR6 (device editor will need to expose power configuration fields).

---

## Core Problem

`onActivate` / `onDeactivate` sequences alone cannot handle power management correctly when switching between persistent states that share a device. Running `onDeactivate` would power off a TV needed by the next state; not running it leaves devices on when switching to an unrelated state. The solution separates power management from lifecycle hooks entirely.

---

## Terminology

| Term | Definition |
|---|---|
| **Active device set** | The set of device IDs that a persistent state requires to be powered on. |
| **Assumed power state** | The system's best-effort belief about whether a device is currently on or off. IR is one-way so this can drift from reality. |
| **Discrete power** | Device has separate power-on and power-off IR codes. |
| **Toggle power** | Device has a single power-toggle IR code. The system tracks assumed state to avoid double-toggling. |

---

## Model Changes

### DeviceId — type change

`DeviceId` changes from `string` to `number` (uint16), consistent with `StateId` and `SequenceId`. All existing references to `DeviceId` in the model, metadata JSON, and binary format adopt the numeric form.

### Device — power configuration and binary promotion

Devices gain power management fields and are promoted to first-class entries in the binary format (see Binary Format section). The full device data (functions, manufacturer, type, etc.) remains in the metadata JSON blob for use by the configurator; the binary section carries only what the firmware needs.

```ts
export type DeviceId       = number;        // was string — breaking change
export type DevicePowerMode = 'toggle' | 'discrete';

export interface Device {
    id: DeviceId;            // now numeric
    name: string;
    manufacturer: string;
    type: DeviceType;
    functions: DeviceFunction[];
    // New:
    powerMode?: DevicePowerMode;    // undefined = power not configured
    powerOnFunction?: string;       // name of a DeviceFunction within this device
    powerOffFunction?: string;      // same as powerOnFunction for toggle devices
}
```

For `toggle` devices, `powerOnFunction` and `powerOffFunction` reference the same function name. The system uses assumed state to decide whether to actually send the code.

### State — active device set

```ts
export interface State {
    // existing fields unchanged...
    activeDevices: DeviceId[];   // set semantics; order does not matter
}
```

`activeDevices` is always empty for ephemeral states — ephemeral states do not participate in power management. `onActivate` and `onDeactivate` only exist on persistent states; ephemeral states have neither.

### Action type — power off active

A new system action type is added:

```ts
export type ActionType =
    | 'navigate'
    | 'ir_send'
    | 'pause'
    | 'rest_call'
    | 'power_off_active';   // new: power off all devices currently believed to be on
```

Wire byte: `0x05`. No params (all four param bytes are `0x00`).

When the firmware executes `power_off_active`:
1. For every device where assumed state is `on` or `unknown`: send its power-off code (respecting power mode).
2. Set all device assumed states to `off`.

This action has no built-in navigation; pair it with a `navigate` action to return home.

---

## Power Transition Logic

### State transitions (firmware)

**Persistent → Persistent** (the common case):

```
toOff  = A.activeDevices − B.activeDevices
toOn   = B.activeDevices − A.activeDevices
shared = A.activeDevices ∩ B.activeDevices  (untouched)
```

Execution order:
1. Power off each device in `toOff`
2. Power on each device in `toOn`
3. Run `A.onDeactivate`
4. Run `B.onActivate`

Power transitions happen before lifecycle hooks so that devices are in the correct state when `onActivate` runs (e.g., an input-select command requires the TV to already be on).

**Persistent → Ephemeral** (pushing a temporary overlay):

No power transitions. No `onDeactivate` on A — the persistent state is not being left; the ephemeral just overlays it temporarily. Ephemeral states have no `onActivate`.

**Ephemeral → Persistent** (returning from an overlay):

No power transitions. Ephemeral states have no `onDeactivate`. The persistent state being returned to does not re-run `onActivate` — it was never deactivated.

**Ephemeral → Ephemeral** (replacing one overlay with another):

No power transitions, no lifecycle hooks on either side.

### Per-device power logic

**Discrete device:**
- `powerOn`: always send `powerOnFunction` IR code; set assumed state → `on`
- `powerOff`: always send `powerOffFunction` IR code; set assumed state → `off`

**Toggle device:**
- `powerOn`: if assumed state is `on` → skip; otherwise send toggle code; set assumed state → `on`
- `powerOff`: if assumed state is `off` → skip; otherwise send toggle code; set assumed state → `off`
- `unknown` assumed state is treated as `off` for `powerOn` (send toggle) and as `on` for `powerOff` (send toggle)

### Assumed power state initialisation

All devices start with assumed state `unknown` on firmware boot. As power commands are sent, state is updated. If a device is in the current state's `activeDevices` and no power command has yet been sent for it (e.g., user imported a config mid-session), its state is `unknown`.

---

## Binary Format Changes

### New section: DEVICES

A new indexed section is added alongside STATES, SEQS, and IR_CODES:

```ts
export const TYPE_DEVICES = 0x04;
```

The section uses the same index structure as STATES and SEQS (`count(2) + index_offset(4)` in the manifest; `id(2) + data_offset(4) + data_length(2)` per index entry).

**Device record layout:**

```
id:                   uint16
power_mode:           uint8     0x00 = not configured, 0x01 = toggle, 0x02 = discrete
power_on_ir_code_id:  uint16    IR code ID; 0xFFFF = not set
power_off_ir_code_id: uint16    IR code ID; 0xFFFF = not set
name:                 null-terminated UTF-8 string
```

7 bytes fixed + variable name. The name is included so the firmware can display it (e.g., on an "all off" confirmation screen) without needing to decompress the metadata blob.

The `power_on_ir_code_id` and `power_off_ir_code_id` reference entries in the global `ir_codes` section. The configurator resolves `powerOnFunction` / `powerOffFunction` → `ActionTemplate` → IR code during serialization, finding or creating entries in `irCodes` as needed (same materialisation path used for button assignments).

All device data beyond power management (functions, manufacturer, type, etc.) remains in the metadata JSON blob. The binary device section carries only what the firmware needs at runtime.

### State record — activeDevices field

A new section is appended to each state record after the existing screen buttons section. Because power codes now live in the DEVICES section, the state record only needs to reference device IDs:

```
active_device_count: uint16
active_device_ids:   [count × uint16]   device IDs; set semantics, order irrelevant
```

### New action type wire byte

```ts
export const ACTION_TYPE_BYTE: Record<ActionType, number> = {
    navigate:          0x01,
    ir_send:           0x02,
    pause:             0x03,
    rest_call:         0x04,
    power_off_active:  0x05,   // new
};
```

---

## Configurator UI

### Device power configuration

In the device settings panel (accessible from the device list in IR4), a new **Power** section appears below the device functions list:

| Control | Description |
|---|---|
| Power mode | Dropdown: None / Toggle / Discrete |
| Power On | (Discrete only) Function picker — lists this device's functions |
| Power Off | (Discrete only) Function picker |
| Power function | (Toggle only) Single function picker — sets both on and off |

When mode is None, the device can still appear in a state's active device set, but no power code is sent — the entry is written with both IR code IDs as `0xFFFF`. This allows the user to include a device in a state for tracking purposes while power commands are not yet configured.

> **Note on IR6 dependency:** This UI lives conceptually in the device editor (IR6), but since IR6 is deferred, a minimal version should be accessible earlier — either as an inline expansion on the device row in the device list, or as a lightweight panel attached to the device discovery dialog. Exact placement is deferred to implementation.

### State active device set

In the state settings panel (shown when no button is selected), a new **Active Devices** section lists all configured devices with checkboxes. Checking a device adds it to `activeDevices`; unchecking removes it.

Devices without power configuration (mode = None) can still be checked; the UI shows a warning icon indicating no power codes are set.

### Action picker — new system action

The **System** section of the action picker gains a new entry:

- **Power off active devices** — creates a `power_off_active` action. No parameters. Intended to be paired with a Navigate action in a sequence (e.g., power off all → navigate to root).

---

## Conventions

- The **root state** should have an empty `activeDevices` set by convention. Navigating home from any persistent state will therefore power off all devices that were in scope.
- `onActivate` / `onDeactivate` are now strictly for non-power setup/teardown: input switching, app launching, display changes, etc.
- If a device lacks power configuration and is in `activeDevices`, the firmware skips sending a power code but still tracks the device in its assumed-state table (so a later `power_off_active` knows the device was active even if it can't turn it off automatically).

---

## Open Questions

1. **Device power UI placement** — inline expansion on device list row vs. a sub-panel within the device discovery dialog vs. deferred entirely to IR6? The model is defined here regardless; only the UI placement is open.
2. **Unknown assumed state on first activation** — when a user enters a state for the first time after boot and all devices are `unknown`, discrete devices always send power-on (safe); toggle devices send the toggle code (assumed off → will turn on). This is the correct default but may cause a visible blip if a device was already on. Acceptable for now, or should we add an explicit "assume all off on boot" setting?
3. **`power_off_active` scope** — should it only power off devices in the current state's `activeDevices`, or all devices across all states where assumed state is `on`/`unknown`? The latter is safer (catches anything accidentally left on) but requires the firmware to track all known devices, not just the current state's set. Recommendation: all devices with assumed state `on`/`unknown`, regardless of current state.
