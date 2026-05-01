import type { RemoteConfig } from '@model/context.ts';

// Binary format constants
const MAGIC = [0x49, 0x52, 0x49, 0x53] as const; // "IRIS"
const VERSION = 0x01;
const TYPE_CONTEXTS   = 0x01;
const TYPE_ITEMS      = 0x02;
const TYPE_STRING_BLOB = 0x03;

const HEADER_SIZE         = 7;  // magic(4) + version(1) + root_context_id(2)
const MANIFEST_ENTRY_SIZE = 11; // type(1) + count(2) + data_offset(4) + id_list_offset(4)
const MANIFEST_SIZE       = 2 + 3 * MANIFEST_ENTRY_SIZE; // entry_count(2) + 3 entries

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

    for (const ctx of config.contexts) {
        addString(ctx.name);
        for (const item of ctx.items) addString(item.label);
    }

    const stringBlobData = concat(blobParts);

    // — Collect unique items across all contexts —
    const itemsById = new Map<number, { labelOffset: number }>();
    for (const ctx of config.contexts) {
        for (const item of ctx.items) {
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

    // — Serialize context records (variable length due to inline item_ids) —
    // id(2) + can_activate(1) + name_offset(4) + item_count(2) + item_ids(item_count × 2)
    const contextParts: Uint8Array[] = [];
    for (const ctx of config.contexts) {
        const nameOffset = stringOffsets.get(ctx.name)!;
        const buf = new Uint8Array(9 + ctx.items.length * 2);
        const v   = new DataView(buf.buffer);
        v.setUint16(0, ctx.id,              true);
        v.setUint8( 2, ctx.canActivate ? 1 : 0);
        v.setUint32(3, nameOffset,          true);
        v.setUint16(7, ctx.items.length,    true);
        ctx.items.forEach((item, j) => v.setUint16(9 + j * 2, item.id, true));
        contextParts.push(buf);
    }
    const contextData = concat(contextParts);

    // — Compute absolute offsets for the manifest —
    const contextOffset    = HEADER_SIZE + MANIFEST_SIZE;
    const itemOffset       = contextOffset + contextData.length;
    const stringBlobOffset = itemOffset    + itemData.length;

    // — Write header —
    const header = new Uint8Array(HEADER_SIZE);
    header.set(MAGIC);
    header[4] = VERSION;
    new DataView(header.buffer).setUint16(5, config.rootContextId, true);

    // — Write manifest —
    const manifest = new Uint8Array(MANIFEST_SIZE);
    const mv       = new DataView(manifest.buffer);
    mv.setUint16(0,  3,                        true); // entry_count

    mv.setUint8( 2,  TYPE_CONTEXTS);                  // entry 0: contexts
    mv.setUint16(3,  config.contexts.length,   true);
    mv.setUint32(5,  contextOffset,            true);
    mv.setUint32(9,  0,                        true); // no separate id list

    mv.setUint8( 13, TYPE_ITEMS);                     // entry 1: items
    mv.setUint16(14, itemList.length,          true);
    mv.setUint32(16, itemOffset,               true);
    mv.setUint32(20, 0,                        true);

    mv.setUint8( 24, TYPE_STRING_BLOB);               // entry 2: string blob
    mv.setUint16(25, stringBlobData.length,    true); // count = byte length for blobs
    mv.setUint32(27, stringBlobOffset,         true);
    mv.setUint32(31, 0,                        true);

    return concat([header, manifest, contextData, itemData, stringBlobData]);
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
