# Device Editor UI

**Goal:** Implement the UI for creating custom devices and editing existing ones (including downloaded catalog devices). This is deferred from IR4, which covers read-only device viewing and catalog-based installation only.

Depends on IR4 (data model, device library, and discovery dialog).

---

## Terminology

See IR4 for definitions of Device, DeviceFunction, ActionTemplate, and TemplateParameter.

---

## Device Edit View

Selecting a device from the device list (IR4) opens its edit view. This view has two parts: the device fields at the top and the function list below.

> **Open question:** Is the edit view a separate page/panel, an inline expansion in the device list, or a modal? Given the function list can grow long, a separate panel or page is probably more appropriate than a modal.

### Device Fields

| Field | Notes |
|---|---|
| Name | e.g. "Living Room TV" — user's label |
| Manufacturer | e.g. "Samsung" |
| Type | IR or REST — read-only once the device has functions |

> **Open question:** Should Name and Manufacturer be separate fields, or a single freeform name? Separate fields allow grouping and future registry matching; a single field is simpler.

Changes to device fields are saved immediately (autosave) or via an explicit save button — TBD.

Type cannot be changed once the device has functions, as the `ActionTemplate` format differs per type. If the device has no functions, type can be freely changed.

### Creating a Device

A "Create device" action in the device list opens the edit view with empty fields. The device is not persisted until at least a name is entered (or until the user saves — see open question above).

> **Open question:** Should there also be a way to create a custom device from inside the discovery dialog (IR4), or is the device list the only entry point for creation?

---

## Function List

Below the device fields, the list of `DeviceFunction` entries for this device. Each row shows:

- Function name
- Template summary (e.g. `IR 0xE0E0E01F` or `POST /api/play`)

From this list the user can:

- Add a new function
- Select a function to edit it
- Delete a function
- Reorder functions (cosmetic only — affects the order shown in the button assignment picker)

---

## Add / Edit Function

Selecting a function (or clicking add) opens a function editor. This may be inline in the list row, a side panel, or a modal — TBD.

### Fields

| Field | Notes |
|---|---|
| Name | Must be unique within the device |
| Template | Type-specific (see below) |

### IR Template Fields

- **Code** — hex input for the 32-bit IR code (e.g. `0xE0E0E01F`)

> **Open question:** Should there be a "Learn" mode that captures an IR code from a physical remote via the hardware? Would require firmware support — likely deferred to a future ticket.

### REST Template Fields

TBD — blocked on the auxiliary resource pool design in IR4. Placeholder fields: URL, HTTP method, optional body, optional template parameters (`TemplateParameter[]`).

---

## Behaviour Rules

- Deleting a function does not affect previously materialized sequences — the copied `Action` values remain authoritative.
- The function list displays a warning on functions whose templates have been used in button assignments, so the user understands that editing the template will not update those assignments.
- Function names must be unique within a device. The UI validates this inline.

---

## Open Questions

1. **Edit view layout** — separate panel/page vs. inline expansion vs. modal? (see above).
2. **Save behaviour** — autosave on change or explicit save button?
3. **Name vs. Name + Manufacturer** — separate fields or single freeform name? (see above).
4. **Function editor placement** — inline row expansion, side panel, or modal?
5. **Device creation entry point** — device list only, or also creatable from the discovery dialog?
6. **IR Learn mode** — capture IR codes via hardware; requires firmware support, likely a future ticket.
7. **REST template fields** — blocked on auxiliary resource pool design (IR4, open question 2).
