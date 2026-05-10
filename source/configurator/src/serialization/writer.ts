import type { RemoteConfig, State, ConfiguratorMetadata } from '@model/state.ts';
import type { Action, Sequence, IRCode } from '@model/actions.ts';
import { ACTION_TYPE_BYTE } from '@model/actions.ts';
import { ButtonCode } from '@model/button-codes.ts';
import {
    MAGIC, VERSION,
    TYPE_STATES, TYPE_SEQS, TYPE_IR_CODES, TYPE_METADATA,
    HEADER_SIZE, MANIFEST_ENTRY_SIZE, INDEX_ENTRY_SIZE,
    SEQUENCE_ID_NONE, ICON_ID_NONE, METADATA_VERSION,
    IR_PROTOCOL_BYTE, BUTTON_CODE_BYTE, STATE_TYPE_BYTE,
} from '@model/serialization.ts';

// ── Helpers ──────────────────────────────────────────────────────────────────

const encoder = new TextEncoder();

function nullTerminated(s: string): Uint8Array {
    const encoded = encoder.encode(s);
    const buf = new Uint8Array(encoded.length + 1);
    buf.set(encoded);
    return buf;
}

function concat(arrays: Uint8Array[]): Uint8Array {
    const total  = arrays.reduce((sum, a) => sum + a.length, 0);
    const result = new Uint8Array(total);
    let offset   = 0;
    for (const a of arrays) {
        result.set(a, offset);
        offset += a.length;
    }
    return result;
}

function writeU16(buf: Uint8Array, offset: number, value: number): void {
    buf[offset]     = value & 0xFF;
    buf[offset + 1] = (value >> 8) & 0xFF;
}

function writeU32(buf: Uint8Array, offset: number, value: number): void {
    buf[offset]     = value & 0xFF;
    buf[offset + 1] = (value >> 8)  & 0xFF;
    buf[offset + 2] = (value >> 16) & 0xFF;
    buf[offset + 3] = (value >> 24) & 0xFF;
}

// ── Serializers ───────────────────────────────────────────────────────────────

function serializeAction(action: Action): Uint8Array {
    const buf = new Uint8Array(5);
    buf[0] = ACTION_TYPE_BYTE[action.type] ?? 0x00;
    buf[1] = action.params[0];
    buf[2] = action.params[1];
    buf[3] = action.params[2];
    buf[4] = action.params[3];
    return buf;
}

function serializeSequenceRecord(seq: Sequence): Uint8Array {
    const parts: Uint8Array[] = [];
    const header = new Uint8Array(3); // id(2) + action_count(1)
    writeU16(header, 0, seq.id);
    header[2] = seq.actions.length;
    parts.push(header);
    for (const action of seq.actions) {
        parts.push(serializeAction(action));
    }
    return concat(parts);
}

function serializeStateRecord(state: State): Uint8Array {
    const parts: Uint8Array[] = [];

    const header = new Uint8Array(8);
    writeU16(header, 0, state.id);
    header[2] = STATE_TYPE_BYTE[state.stateType];
    header[3] = state.buttonFallback ? 1 : 0;
    writeU16(header, 4, state.onActivate   ?? SEQUENCE_ID_NONE);
    writeU16(header, 6, state.onDeactivate ?? SEQUENCE_ID_NONE);
    parts.push(header);

    parts.push(nullTerminated(state.name));

    const physHeader = new Uint8Array(1);
    physHeader[0] = state.physicalButtons.length;
    parts.push(physHeader);
    for (const phys of state.physicalButtons) {
        const rec = new Uint8Array(4);
        rec[0] = BUTTON_CODE_BYTE[phys.buttonCode as ButtonCode] ?? 0x00;
        rec[1] = 0x00;
        writeU16(rec, 2, phys.sequenceId);
        parts.push(rec);
    }

    const screenHeader = new Uint8Array(2);
    writeU16(screenHeader, 0, state.screenButtons.length);
    parts.push(screenHeader);
    for (const btn of state.screenButtons) {
        const rec: Uint8Array[] = [];
        rec.push(nullTerminated(btn.label));
        const fixed = new Uint8Array(4);
        writeU16(fixed, 0, ICON_ID_NONE);
        writeU16(fixed, 2, btn.sequenceId);
        rec.push(fixed);
        parts.push(concat(rec));
    }

    return concat(parts);
}

// Each IR code record: id(2) + protocol(1) + code(8) = 11 bytes
function serializeIRCode(irCode: IRCode): Uint8Array {
    const buf  = new Uint8Array(11);
    const view = new DataView(buf.buffer);
    view.setUint16(0, irCode.id, true);
    buf[2] = IR_PROTOCOL_BYTE[irCode.protocol];
    view.setBigUint64(3, irCode.code, true);
    return buf;
}

function serializeIRCodesSection(irCodes: IRCode[]): Uint8Array {
    const parts: Uint8Array[] = [];
    const header = new Uint8Array(2);
    writeU16(header, 0, irCodes.length);
    parts.push(header);
    for (const code of irCodes) {
        parts.push(serializeIRCode(code));
    }
    return concat(parts);
}

async function compressMetadata(metadata: ConfiguratorMetadata): Promise<Uint8Array> {
    const payload = {
        version:             METADATA_VERSION,
        ...metadata.extra,
        devices:             metadata.devices,
        sequenceAnnotations: metadata.sequenceAnnotations,
    };

    const json = JSON.stringify(
        payload,
        (_, value) => typeof value === 'bigint' ? '0x' + value.toString(16) : value,
    );

    const stream = new CompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();

    writer.write(encoder.encode(json));
    writer.close();

    const chunks: Uint8Array[] = [];
    const reader = stream.readable.getReader();

    while (true) {
        const { done, value } = await reader.read();

        if (done) {
            break;
        }

        chunks.push(value);
    }

    return concat(chunks);
}

// ── Resource index builder ────────────────────────────────────────────────────

interface IndexedRecord { id: number; data: Uint8Array; }

function buildIndex(records: IndexedRecord[], baseOffset: number): { index: Uint8Array; data: Uint8Array } {
    const indexBuf  = new Uint8Array(records.length * INDEX_ENTRY_SIZE);
    const dataParts: Uint8Array[] = [];
    let dataOffset  = baseOffset + records.length * INDEX_ENTRY_SIZE;

    records.forEach((rec, i) => {
        writeU16(indexBuf, i * INDEX_ENTRY_SIZE,     rec.id);
        writeU32(indexBuf, i * INDEX_ENTRY_SIZE + 2, dataOffset);
        writeU16(indexBuf, i * INDEX_ENTRY_SIZE + 6, rec.data.length);
        dataParts.push(rec.data);
        dataOffset += rec.data.length;
    });

    return { index: indexBuf, data: concat(dataParts) };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function serialize(config: RemoteConfig): Promise<Uint8Array> {
    const sectionCount = 4; // states, sequences, ir_codes, metadata
    const manifestSize = 2 + sectionCount * MANIFEST_ENTRY_SIZE;

    // ── Serialize records ──
    const stateRecords: IndexedRecord[] = config.states.map(s => ({
        id:   s.id,
        data: serializeStateRecord(s),
    }));
    const seqRecords: IndexedRecord[] = config.sequences.map(s => ({
        id:   s.id,
        data: serializeSequenceRecord(s),
    }));
    const irCodesBytes   = serializeIRCodesSection(config.irCodes);
    const metadataBytes  = await compressMetadata(config.metadata);

    // ── Compute layout ──
    const stateIndexOffset = HEADER_SIZE + manifestSize;
    const { index: stateIndex, data: stateData } = buildIndex(stateRecords, stateIndexOffset);

    const seqIndexOffset = stateIndexOffset + stateIndex.length + stateData.length;
    const { index: seqIndex, data: seqData } = buildIndex(seqRecords, seqIndexOffset);

    const irCodesOffset  = seqIndexOffset + seqIndex.length + seqData.length;
    const metadataOffset = irCodesOffset  + irCodesBytes.length;

    // ── Header ──
    const header = new Uint8Array(HEADER_SIZE);
    header.set(MAGIC);
    header[4] = VERSION;
    writeU16(header, 5, config.rootStateId);

    // ── Manifest ──
    const manifest = new Uint8Array(2 + sectionCount * MANIFEST_ENTRY_SIZE);
    writeU16(manifest, 0, sectionCount);

    let me = 2;

    manifest[me] = TYPE_STATES;
    writeU16(manifest, me + 1, config.states.length);
    writeU32(manifest, me + 3, stateIndexOffset);
    writeU32(manifest, me + 7, 0);
    me += MANIFEST_ENTRY_SIZE;

    manifest[me] = TYPE_SEQS;
    writeU16(manifest, me + 1, config.sequences.length);
    writeU32(manifest, me + 3, seqIndexOffset);
    writeU32(manifest, me + 7, 0);
    me += MANIFEST_ENTRY_SIZE;

    // IR codes: count = number of records, data_offset = section start
    manifest[me] = TYPE_IR_CODES;
    writeU16(manifest, me + 1, config.irCodes.length);
    writeU32(manifest, me + 3, 0);
    writeU32(manifest, me + 7, irCodesOffset);
    me += MANIFEST_ENTRY_SIZE;

    // Metadata: count = compressed byte length, data_offset = section start
    manifest[me] = TYPE_METADATA;
    writeU16(manifest, me + 1, metadataBytes.length);
    writeU32(manifest, me + 3, 0);
    writeU32(manifest, me + 7, metadataOffset);

    return concat([header, manifest, stateIndex, stateData, seqIndex, seqData, irCodesBytes, metadataBytes]);
}

export async function downloadBin(config: RemoteConfig, filename = 'remote.bin'): Promise<void> {
    const bytes = await serialize(config);
    const blob  = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
