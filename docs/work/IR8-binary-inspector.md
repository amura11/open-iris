# Binary Config Inspector

**Goal:** A read-only tool for inspecting the contents of an exported `remote.bin` file. The user opens a file and sees the raw hex alongside semantic annotations — labelled, colour-coded spans that identify each field and block, with a structure tree for navigation.

No dependencies on other IRs. Operates independently of the main configurator flow.

---

## Background

The `remote.bin` format (v4) has the following top-level layout:

```
Header (7 bytes)        magic(4) + version(1) + root_state_id(2)
Manifest                section_count(2) + N × manifest_entry(11)
States index            N × index_entry(8)
States data             variable — one state record per entry
Sequences index         N × index_entry(8)
Sequences data          variable — one sequence record per entry
IR codes section        count(2) + N × ir_code_record(11)
Metadata section        deflate-raw compressed JSON blob
```

State records, sequence records, and IR code records each have a known internal structure (see `writer.ts` / `reader.ts`). The metadata blob is opaque binary but its decompressed content is human-readable JSON.

---

## Entry Point

An **Inspect** button is added to the configurator header alongside Import/Export. Clicking it opens a file picker (`.bin` only); selecting a file opens the inspector view.

The inspector is a full-page overlay rather than a modal, because the hex view needs horizontal and vertical room to breathe. A future enhancement could allow the configurator to generate a config and send it directly to the inspector without touching the filesystem — the overlay approach keeps that straightforward since both views live in the same app context.

---

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Inspector  ·  remote.bin  ·  1 234 bytes          [×  Close]   │
├──────────────────────────────────┬──────────────────────────────┤
│  Hex dump                        │  Structure tree              │
│                                  │                              │
│  0000  49 52 49 53 04 01 00  …   │  ▾ Header                   │
│  0009  01 03 00 09 00 00 00  …   │    Magic                     │
│  …                               │    Version                   │
│                                  │    Root State ID             │
│                                  │  ▾ Manifest                  │
│                                  │    Section: STATES           │
│                                  │    Section: SEQS             │
│                                  │    Section: IR_CODES         │
│                                  │    Section: META             │
│                                  │  ▾ States                    │
│                                  │    ▾ State 1 "Root"          │
│                                  │      Header                  │
│                                  │      Name                    │
│                                  │      Phys buttons            │
│                                  │      Screen buttons          │
│                                  │    State 2 "TV Mode"         │
│                                  │  ▾ Sequences                 │
│                                  │    Sequence 1                │
│                                  ├──────────────────────────────┤
│                                  │  Field detail                │
│                                  │                              │
│                                  │  root_state_id  ·  bytes 5–6 │
│                                  │  uint16 LE  →  1             │
└──────────────────────────────────┴──────────────────────────────┘
```

- **Left:** Hex dump with colour-coded spans. Clicking a byte selects the narrowest span that contains it and updates the right panel.
- **Top-right:** Collapsible structure tree. Clicking a node scrolls the hex view to its byte range and highlights the corresponding span.
- **Bottom-right:** Field detail panel — field name, byte range, encoding, and decoded value.

---

## Hex Dump

### Format

Classic `xxd`-style: address column, 16 hex bytes per row, printable ASCII on the right.

```
0000  49 52 49 53 04 01 00  02 00 01 03 00 09 00 00  IRIS...........
0010  00 00 00 02 03 00 ...
```

A gap or faint divider may be added between major sections to aid scanning.

### Colour coding

Each span kind gets a distinct background tint applied to its bytes in the hex and ASCII columns. Overlapping spans (e.g., a field inside a record inside a section) use the innermost span's colour; outer-span boundaries are shown as a left/right border on the row.

| Span kind | Colour family |
|---|---|
| Header | Blue |
| Manifest | Purple |
| States section — index | Teal |
| States section — records | Green (alternating shades per state) |
| Sequences section — index | Teal |
| Sequences section — records | Amber (alternating shades per sequence) |
| IR codes section | Orange |
| Metadata section | Gray (opaque blob) |

Selected span: highlighted with a solid primary-colour border, all other spans dimmed slightly.

### Interaction

- **Click a byte** → selects the narrowest span containing that byte; scrolls the tree to the matching node; updates the field detail panel.
- **Click a tree node** → selects the node's span; scrolls the hex view to the first byte of that span; updates the detail panel.
- **Hover a byte** → shows a tooltip with the span name and decoded value, without changing the selection.

---

## Structure Tree

The tree mirrors the binary layout exactly:

```
▾ Header
    Magic                    49 52 49 53   "IRIS"
    Version                  04            4
    Root State ID            01 00         1

▾ Manifest
    Section count            02 00         2
  ▾ Entry 0 — STATES
      Type tag               01            STATES
      Count                  03 00         3
      Index offset           09 00 00 00   9
      Data offset            00 00 00 00   (unused)
  ▾ Entry 1 — SEQS
      …

▾ States
  ▾ Index
      Entry 0 (State 1)      id=1  offset=…  len=…
      Entry 1 (State 2)      …
  ▾ Records
    ▾ State 1  "Root"
        id                   01 00
        state_type           00            root
        button_fallback      00            false
        on_activate          FF FF         (none)
        on_deactivate        FF FF         (none)
        name                 52 6F 6F 74 00  "Root"
      ▾ Physical buttons     count: 2
          Button 0           code=VOL_UP  seq=1
          Button 1           …
      ▾ Screen buttons       count: 1
          Button 0           label="Volume"  seq=2
    ▾ State 2  "TV Mode"
        …

▾ Sequences
  ▾ Index
      …
  ▾ Records
    ▾ Sequence 1  (2 actions)
      ▾ Action 0             ir_send  irCodeId=3
        Action 1             pause  600ms

▾ IR Codes               count: 4
    IR Code 1              NEC  0xE0E0E01F
    IR Code 2              Samsung  0xABCD1234
    …

▾ Metadata               (compressed, 312 bytes)
    (decompressed JSON tree or raw text preview)
```

Each leaf label in the tree renders: **field name** · **raw hex bytes** · **decoded value**. Internal nodes show a summary (count, name, etc.).

---

## Annotating Reader

The inspector does not reuse `reader.ts` directly. A new module — `annotate.ts` — walks the bytes in the same order as the reader and produces a flat list of `Span` values instead of a `RemoteConfig`:

```ts
export type SpanKind =
    | 'header' | 'manifest' | 'manifest-entry'
    | 'states-index' | 'states-record' | 'state-field'
    | 'seqs-index'   | 'seqs-record'   | 'seq-field'
    | 'ir-codes'     | 'ir-code-field'
    | 'metadata';

export interface Span {
    start:   number;       // inclusive byte offset
    end:     number;       // exclusive byte offset
    label:   string;       // human-readable field name, e.g. "root_state_id"
    kind:    SpanKind;
    value?:  string;       // decoded value as a display string, e.g. "1" or "NEC"
    children?: Span[];     // nested sub-spans (fields within a record)
}

export function annotate(bytes: Uint8Array): Span[];
```

`annotate` is synchronous — the metadata blob is annotated as an opaque span; its JSON content is decompressed separately and shown as a formatted text preview in the tree (not byte-annotated, since the content is compressed).

The flat span list is used by the hex view for colouring and hit-testing. The nested `children` structure is used by the tree component.

---

## Metadata Section Display

The metadata section is a deflate-raw compressed JSON blob. In the inspector:

- The hex view shows it as a single opaque gray span.
- The tree node expands to show the decompressed JSON in a scrollable `<pre>` block.
- Decompression uses the same `DecompressionStream('deflate-raw')` approach as `reader.ts`.

---

## Error Handling

If the file fails the magic check or version check, the inspector shows an error message in place of the hex view. Bytes are still shown in the hex dump in a neutral colour so the user can see what was actually in the file.

If a span cannot be fully parsed (e.g., truncated record), parsing stops at the error byte; all successfully annotated spans up to that point are still rendered, and the error position is marked in the hex view.

---

## Component Summary

| Component / Module | Purpose |
|---|---|
| `annotate.ts` | Produces the `Span[]` tree from raw bytes |
| `InspectorView.svelte` | Top-level layout — tree + hex + detail panel |
| `HexDump.svelte` | Renders the hex grid; handles click/hover, span colouring |
| `SpanTree.svelte` | Recursive tree component for the structure panel |
| `FieldDetail.svelte` | Shows name, byte range, encoding, and decoded value for the selected span |

