import type { RemoteConfig, StateType } from '@model/state.ts';

// Binary format constants
const MAGIC = [0x49, 0x52, 0x49, 0x53] as const; // "IRIS"
const VERSION = 0x02;
const TYPE_STATES      = 0x01;
const TYPE_ITEMS       = 0x02;
const TYPE_STRING_BLOB = 0x03;

const HEADER_SIZE         = 7;  // magic(4) + version(1) + root_state_id(2)
const MANIFEST_ENTRY_SIZE = 11; // type(1) + count(2) + data_offset(4) + id_list_offset(4)
const MANIFEST_SIZE       = 2 + 3 * MANIFEST_ENTRY_SIZE; // entry_count(2) + 3 entries

const STATE_TYPE_BYTE: Record<StateType, number> = {
    root:       0x00,
    persistent: 0x01,
    ephemeral:  0x02,
};

export function serialize(config: RemoteConfig): Uint8Array {
    const encoder = new TextEncoder();

    // — Pass 1: build the string blob and record each string's byte offset —
    const blobParts: Uint8Array[] = [];
    const stringOffsets = new Map<string, number>();
    let blobLen = 0;

    function addString(s: string): number {
        const existing = stringOffsets.get(s);
        if (existing !== undefined) return existing;
        const offset = blobLen;
        stringOffsets.set(s, offset);
        const encoded = encoder.encode(s);
        blobParts.push(encoded, new Uint8Array([0])); // null-terminated
        blobLen += encoded.length + 1;
        return offset;
    }

    for (const state of config.states) {
        addString(state.name);
        for (const item of state.items) addString(item.label);
    }

    const stringBlobData = concat(blobParts);

    // — Collect unique items across all states —
    const itemsById = new Map<number, { labelOffset: number }>();
    for (const state of config.states) {
        for (const item of state.items) {
            if (!itemsById.has(item.id)) {
                itemsById.set(item.id, { labelOffset: stringOffsets.get(item.label)! });
            }
        }
    }
    const itemList = [...itemsById.entries()]; // [id, {labelOffset}]

    // — Serialize item records: id(2) + label_offset(4) = 6 bytes each —
    const ITEM_RECORD_SIZE = 6;
    const itemData = new Uint8Array(itemList.length * ITEM_RECORD_SIZE);
    const itemView = new DataView(itemData.buffer);
    itemList.forEach(([id, { labelOffset }], i) => {
        itemView.setUint16(i * ITEM_RECORD_SIZE,     id,          true);
        itemView.setUint32(i * ITEM_RECORD_SIZE + 2, labelOffset, true);
    });

    // — Serialize state records (variable length due to inline item_ids) —
    // id(2) + state_type(1) + button_fallback(1) + name_offset(4) + item_count(2) + item_ids(item_count × 2)
    const stateParts: Uint8Array[] = [];
    for (const state of config.states) {
        const nameOffset = stringOffsets.get(state.name)!;
        const buf = new Uint8Array(10 + state.items.length * 2);
        const v   = new DataView(buf.buffer);
        v.setUint16(0, state.id,                          true);
        v.setUint8( 2, STATE_TYPE_BYTE[state.stateType]);
        v.setUint8( 3, state.buttonFallback ? 1 : 0);
        v.setUint32(4, nameOffset,                        true);
        v.setUint16(8, state.items.length,                true);
        state.items.forEach((item, j) => v.setUint16(10 + j * 2, item.id, true));
        stateParts.push(buf);
    }
    const stateData = concat(stateParts);

    // — Compute absolute offsets for the manifest —
    const stateOffset       = HEADER_SIZE + MANIFEST_SIZE;
    const itemOffset        = stateOffset + stateData.length;
    const stringBlobOffset  = itemOffset  + itemData.length;

    // — Write header —
    const header = new Uint8Array(HEADER_SIZE);
    header.set(MAGIC);
    header[4] = VERSION;
    new DataView(header.buffer).setUint16(5, config.rootStateId, true);

    // — Write manifest —
    const manifest = new Uint8Array(MANIFEST_SIZE);
    const mv       = new DataView(manifest.buffer);
    mv.setUint16(0,  3,                       true); // entry_count

    mv.setUint8( 2,  TYPE_STATES);                   // entry 0: states
    mv.setUint16(3,  config.states.length,    true);
    mv.setUint32(5,  stateOffset,             true);
    mv.setUint32(9,  0,                       true); // no separate id list

    mv.setUint8( 13, TYPE_ITEMS);                    // entry 1: items
    mv.setUint16(14, itemList.length,         true);
    mv.setUint32(16, itemOffset,              true);
    mv.setUint32(20, 0,                       true);

    mv.setUint8( 24, TYPE_STRING_BLOB);              // entry 2: string blob
    mv.setUint16(25, stringBlobData.length,   true); // count = byte length for blobs
    mv.setUint32(27, stringBlobOffset,        true);
    mv.setUint32(31, 0,                       true);

    return concat([header, manifest, stateData, itemData, stringBlobData]);
}

export function downloadBin(config: RemoteConfig, filename = 'remote.bin'): void {
    const bytes = serialize(config);
    // concat() always produces a plain ArrayBuffer; cast needed due to TS5 Uint8Array<ArrayBufferLike> widening
    const blob  = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function concat(arrays: Uint8Array[]): Uint8Array {
    const total  = arrays.reduce((sum, a) => sum + a.length, 0);
    const result = new Uint8Array(total);
    let offset   = 0;
    for (const a of arrays) { result.set(a, offset); offset += a.length; }
    return result;
}
