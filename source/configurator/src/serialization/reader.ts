import type { RemoteConfig, Context, Item } from '@model/context.ts';

const MAGIC = [0x49, 0x52, 0x49, 0x53] as const; // "IRIS"
const VERSION = 0x01;
const TYPE_CONTEXTS    = 0x01;
const TYPE_ITEMS       = 0x02;
const TYPE_STRING_BLOB = 0x03;

export function deserialize(bytes: Uint8Array): RemoteConfig {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    // Validate magic + version
    for (let i = 0; i < 4; i++) {
        if (bytes[i] !== MAGIC[i]) throw new Error('Invalid file: missing IRIS magic bytes');
    }
    if (bytes[4] !== VERSION) {
        throw new Error(`Unsupported version: 0x${bytes[4].toString(16).padStart(2, '0')}`);
    }

    const rootContextId = view.getUint16(5, true);
    const entryCount    = view.getUint16(7, true);

    // Parse manifest entries
    let contextsBlock:   { count: number; offset: number } | null = null;
    let itemsBlock:      { count: number; offset: number } | null = null;
    let stringBlobBlock: { byteLength: number; offset: number } | null = null;

    let pos = 9; // offset after header(7) + entry_count(2)
    for (let i = 0; i < entryCount; i++) {
        const typeTag    = bytes[pos];
        const count      = view.getUint16(pos + 1, true);
        const dataOffset = view.getUint32(pos + 3, true);
        // id_list_offset at pos+7 — not needed for reading
        pos += 11;

        if      (typeTag === TYPE_CONTEXTS)    contextsBlock   = { count,              offset: dataOffset };
        else if (typeTag === TYPE_ITEMS)       itemsBlock      = { count,              offset: dataOffset };
        else if (typeTag === TYPE_STRING_BLOB) stringBlobBlock = { byteLength: count,  offset: dataOffset };
    }

    if (!stringBlobBlock) throw new Error('Corrupt file: missing string blob block in manifest');

    // Decode a null-terminated UTF-8 string at a given offset within the blob
    const decoder = new TextDecoder();
    function getString(blobRelativeOffset: number): string {
        const start = stringBlobBlock!.offset + blobRelativeOffset;
        let end = start;
        while (end < bytes.length && bytes[end] !== 0) end++;
        return decoder.decode(bytes.subarray(start, end));
    }

    // — Parse item records: id(2) + label_offset(4) —
    const itemsById = new Map<number, Item>();
    if (itemsBlock) {
        let p = itemsBlock.offset;
        for (let i = 0; i < itemsBlock.count; i++) {
            const id          = view.getUint16(p,     true);
            const labelOffset = view.getUint32(p + 2, true);
            itemsById.set(id, { id, label: getString(labelOffset) });
            p += 6;
        }
    }

    // — Parse context records (variable length) —
    // id(2) + can_activate(1) + name_offset(4) + item_count(2) + item_ids(item_count × 2)
    const contexts: Context[] = [];
    if (contextsBlock) {
        let p = contextsBlock.offset;
        for (let i = 0; i < contextsBlock.count; i++) {
            const id          = view.getUint16(p,     true);
            const canActivate = bytes[p + 2] !== 0;
            const nameOffset  = view.getUint32(p + 3, true);
            const itemCount   = view.getUint16(p + 7, true);

            const items: Item[] = [];
            for (let j = 0; j < itemCount; j++) {
                const itemId = view.getUint16(p + 9 + j * 2, true);
                const item   = itemsById.get(itemId);
                if (item) items.push(item);
            }

            contexts.push({
                id,
                name: getString(nameOffset),
                canActivate,
                items,
                onActivateCommands:   [],
                onDeactivateCommands: [],
            });

            p += 9 + itemCount * 2;
        }
    }

    return { rootContextId, contexts };
}
