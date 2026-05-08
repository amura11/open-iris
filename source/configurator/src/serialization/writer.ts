import type { RemoteConfig, State, StateType } from '@model/state.ts';
import type { Action, Sequence } from '@model/actions.ts';
import { ButtonCode } from '@model/button-codes.ts';

// ── Constants ────────────────────────────────────────────────────────────────

const MAGIC   = [0x49, 0x52, 0x49, 0x53] as const; // "IRIS"
const VERSION = 0x03;

const TYPE_STATES   = 0x01;
const TYPE_SEQS     = 0x02;
const TYPE_METADATA = 0xFF;

const HEADER_SIZE         = 7;  // magic(4) + version(1) + root_state_id(2)
const MANIFEST_ENTRY_SIZE = 11; // type_tag(1) + count(2) + index_offset(4) + data_offset(4)
const INDEX_ENTRY_SIZE    = 8;  // id(2) + data_offset(4) + data_length(2)

const STATE_TYPE_BYTE: Record<StateType, number> = {
    root:       0x00,
    persistent: 0x01,
    ephemeral:  0x02,
};

// Numeric encoding for ButtonCode — must stay in sync with firmware button_codes.h
const BUTTON_CODE_BYTE: Record<ButtonCode, number> = {
    [ButtonCode.POWER]:       0x00,
    [ButtonCode.SOURCE]:      0x01,
    [ButtonCode.DPAD_UP]:     0x02,
    [ButtonCode.DPAD_DOWN]:   0x03,
    [ButtonCode.DPAD_LEFT]:   0x04,
    [ButtonCode.DPAD_RIGHT]:  0x05,
    [ButtonCode.DPAD_CENTER]: 0x06,
    [ButtonCode.BACK]:        0x07,
    [ButtonCode.HOME]:        0x08,
    [ButtonCode.PLAY_PAUSE]:  0x09,
    [ButtonCode.MUTE]:        0x0A,
    [ButtonCode.VOL_UP]:      0x0B,
    [ButtonCode.VOL_DOWN]:    0x0C,
    [ButtonCode.PAGE_UP]:     0x0D,
    [ButtonCode.PAGE_DOWN]:   0x0E,
    [ButtonCode.PROG_1]:      0x0F,
    [ButtonCode.PROG_2]:      0x10,
    [ButtonCode.PROG_3]:      0x11,
    [ButtonCode.PROG_4]:      0x12,
    [ButtonCode.PROG_5]:      0x13,
    [ButtonCode.PROG_6]:      0x14,
};

const SEQUENCE_ID_NONE = 0xFFFF;
const ICON_ID_NONE     = 0xFFFF;

// ── Helpers ──────────────────────────────────────────────────────────────────

const encoder = new TextEncoder();

function nullTerminated(s: string): Uint8Array {
    const encoded = encoder.encode(s);
    const buf = new Uint8Array(encoded.length + 1);
    buf.set(encoded);
    return buf; // last byte is already 0x00
}

function concat(arrays: Uint8Array[]): Uint8Array {
    const total  = arrays.reduce((sum, a) => sum + a.length, 0);
    const result = new Uint8Array(total);
    let offset   = 0;
    for (const a of arrays) { result.set(a, offset); offset += a.length; }
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
    // action_type byte TBD — store 0x00 as placeholder until ActionType enum is defined
    buf[0] = 0x00;
    buf[1] = action.params[0];
    buf[2] = action.params[1];
    buf[3] = action.params[2];
    buf[4] = action.params[3];
    return buf;
}

function serializeSequenceRecord(seq: { id: number; actions: Action[] }): Uint8Array {
    const parts: Uint8Array[] = [];
    const header = new Uint8Array(3); // id(2) + action_count(1)
    writeU16(header, 0, seq.id);
    header[2] = seq.actions.length;
    parts.push(header);
    for (const action of seq.actions) parts.push(serializeAction(action));
    return concat(parts);
}

function serializeStateRecord(state: State): Uint8Array {
    const parts: Uint8Array[] = [];

    // Fixed-size header: id(2) + state_type(1) + button_fallback(1) + on_activate(2) + on_deactivate(2)
    const header = new Uint8Array(8);
    writeU16(header, 0, state.id);
    header[2] = STATE_TYPE_BYTE[state.stateType];
    header[3] = state.buttonFallback ? 1 : 0;
    writeU16(header, 4, state.onActivate  ?? SEQUENCE_ID_NONE);
    writeU16(header, 6, state.onDeactivate ?? SEQUENCE_ID_NONE);
    parts.push(header);

    // name (null-terminated)
    parts.push(nullTerminated(state.name));

    // physical buttons: count(1) + configs(count × 4)
    const physHeader = new Uint8Array(1);
    physHeader[0] = state.physicalButtons.length;
    parts.push(physHeader);
    for (const phys of state.physicalButtons) {
        const rec = new Uint8Array(4);
        rec[0] = BUTTON_CODE_BYTE[phys.buttonCode as ButtonCode] ?? 0x00;
        rec[1] = 0x00; // reserved
        writeU16(rec, 2, phys.sequenceId);
        parts.push(rec);
    }

    // screen buttons: count(2) + configs(variable)
    const screenHeader = new Uint8Array(2);
    writeU16(screenHeader, 0, state.screenButtons.length);
    parts.push(screenHeader);
    for (const btn of state.screenButtons) {
        const rec: Uint8Array[] = [];
        rec.push(nullTerminated(btn.label));
        const fixed = new Uint8Array(4); // icon_id(2) + sequence_id(2)
        writeU16(fixed, 0, ICON_ID_NONE); // icon not yet implemented
        writeU16(fixed, 2, btn.sequenceId);
        rec.push(fixed);
        parts.push(concat(rec));
    }

    return concat(parts);
}

function serializeMetadata(sequences: Sequence[]): Uint8Array {
    const named = sequences.filter(s => s.name !== undefined);
    const parts: Uint8Array[] = [];
    const header = new Uint8Array(2);
    writeU16(header, 0, named.length);
    parts.push(header);
    for (const seq of named) {
        const idBuf = new Uint8Array(2);
        writeU16(idBuf, 0, seq.id);
        parts.push(idBuf);
        parts.push(nullTerminated(seq.name!));
    }
    return concat(parts);
}

// ── Resource index builder ────────────────────────────────────────────────────

interface IndexedRecord { id: number; data: Uint8Array; }

function buildIndex(records: IndexedRecord[], baseOffset: number): { index: Uint8Array; data: Uint8Array } {
    const indexBuf = new Uint8Array(records.length * INDEX_ENTRY_SIZE);
    const dataParts: Uint8Array[] = [];
    let dataOffset = baseOffset + records.length * INDEX_ENTRY_SIZE;

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

export function serialize(config: RemoteConfig): Uint8Array {
    const sectionCount = 3; // states, sequences, metadata
    const manifestSize = 2 + sectionCount * MANIFEST_ENTRY_SIZE;

    // ── Serialize data records ──
    const stateRecords: IndexedRecord[] = config.states.map(s => ({
        id:   s.id,
        data: serializeStateRecord(s),
    }));
    const seqRecords: IndexedRecord[] = config.sequences.map(s => ({
        id:   s.id,
        data: serializeSequenceRecord(s),
    }));
    const metadataBytes = serializeMetadata(config.sequences);

    // ── Compute layout: header | manifest | state index+data | seq index+data | metadata ──
    const stateIndexOffset = HEADER_SIZE + manifestSize;
    const { index: stateIndex, data: stateData } = buildIndex(stateRecords, stateIndexOffset);

    const seqIndexOffset = stateIndexOffset + stateIndex.length + stateData.length;
    const { index: seqIndex, data: seqData } = buildIndex(seqRecords, seqIndexOffset);

    const metadataOffset = seqIndexOffset + seqIndex.length + seqData.length;

    // ── Header ──
    const header = new Uint8Array(HEADER_SIZE);
    header.set(MAGIC);
    header[4] = VERSION;
    writeU16(header, 5, config.rootStateId);

    // ── Manifest ──
    const manifest = new Uint8Array(2 + sectionCount * MANIFEST_ENTRY_SIZE);
    writeU16(manifest, 0, sectionCount);

    let me = 2; // manifest entry cursor

    // Entry 0: states (indexed — data_offset = 0)
    manifest[me] = TYPE_STATES;
    writeU16(manifest, me + 1, config.states.length);
    writeU32(manifest, me + 3, stateIndexOffset);
    writeU32(manifest, me + 7, 0);
    me += MANIFEST_ENTRY_SIZE;

    // Entry 1: sequences (indexed — data_offset = 0)
    manifest[me] = TYPE_SEQS;
    writeU16(manifest, me + 1, config.sequences.length);
    writeU32(manifest, me + 3, seqIndexOffset);
    writeU32(manifest, me + 7, 0);
    me += MANIFEST_ENTRY_SIZE;

    // Entry 2: metadata (not indexed — index_offset = 0)
    manifest[me] = TYPE_METADATA;
    writeU16(manifest, me + 1, metadataBytes.length);
    writeU32(manifest, me + 3, 0);
    writeU32(manifest, me + 7, metadataOffset);

    return concat([header, manifest, stateIndex, stateData, seqIndex, seqData, metadataBytes]);
}

export function downloadBin(config: RemoteConfig, filename = 'remote.bin'): void {
    const bytes = serialize(config);
    const blob  = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
