import type { RemoteConfig, State, StateType } from '@model/state.ts';
import type { Sequence, Action, ActionType, ScreenButtonConfig, PhysicalButtonConfig } from '@model/actions.ts';
import { ButtonCode } from '@model/button-codes.ts';

// ── Constants ────────────────────────────────────────────────────────────────

const MAGIC   = [0x49, 0x52, 0x49, 0x53] as const; // "IRIS"
const VERSION = 0x03;

const TYPE_STATES   = 0x01;
const TYPE_SEQS     = 0x02;
const TYPE_METADATA = 0xFF;

const INDEX_ENTRY_SIZE = 8; // id(2) + data_offset(4) + data_length(2)

const STATE_TYPE_MAP: Record<number, StateType> = {
    0x00: 'root',
    0x01: 'persistent',
    0x02: 'ephemeral',
};

// Inverse of the writer's BUTTON_CODE_BYTE map
const BYTE_TO_BUTTON_CODE: Record<number, ButtonCode> = {
    0x00: ButtonCode.POWER,
    0x01: ButtonCode.SOURCE,
    0x02: ButtonCode.DPAD_UP,
    0x03: ButtonCode.DPAD_DOWN,
    0x04: ButtonCode.DPAD_LEFT,
    0x05: ButtonCode.DPAD_RIGHT,
    0x06: ButtonCode.DPAD_CENTER,
    0x07: ButtonCode.BACK,
    0x08: ButtonCode.HOME,
    0x09: ButtonCode.PLAY_PAUSE,
    0x0A: ButtonCode.MUTE,
    0x0B: ButtonCode.VOL_UP,
    0x0C: ButtonCode.VOL_DOWN,
    0x0D: ButtonCode.PAGE_UP,
    0x0E: ButtonCode.PAGE_DOWN,
    0x0F: ButtonCode.PROG_1,
    0x10: ButtonCode.PROG_2,
    0x11: ButtonCode.PROG_3,
    0x12: ButtonCode.PROG_4,
    0x13: ButtonCode.PROG_5,
    0x14: ButtonCode.PROG_6,
};

const SEQUENCE_ID_NONE = 0xFFFF;

// ── Helpers ──────────────────────────────────────────────────────────────────

const decoder = new TextDecoder();

function readU16(bytes: Uint8Array, offset: number): number {
    return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
    return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function readNullTerminated(bytes: Uint8Array, offset: number): { value: string; nextOffset: number } {
    let end = offset;
    while (end < bytes.length && bytes[end] !== 0) end++;
    return { value: decoder.decode(bytes.subarray(offset, end)), nextOffset: end + 1 };
}

// ── Section index types ───────────────────────────────────────────────────────

interface IndexEntry { id: number; dataOffset: number; dataLength: number; }
interface SectionIndex { entries: IndexEntry[]; }

function readIndex(bytes: Uint8Array, indexOffset: number, count: number): SectionIndex {
    const entries: IndexEntry[] = [];
    for (let i = 0; i < count; i++) {
        const base = indexOffset + i * INDEX_ENTRY_SIZE;
        entries.push({
            id:         readU16(bytes, base),
            dataOffset: readU32(bytes, base + 2),
            dataLength: readU16(bytes, base + 6),
        });
    }
    return { entries };
}

function findEntry(index: SectionIndex, id: number): IndexEntry | undefined {
    return index.entries.find(e => e.id === id);
}

// ── Record parsers ────────────────────────────────────────────────────────────

function parseStateRecord(bytes: Uint8Array, entry: IndexEntry, nextScreenButtonId: { value: number }): State {
    let p = entry.dataOffset;

    const id             = readU16(bytes, p); p += 2;
    const stateTypeByte  = bytes[p++];
    const buttonFallback = bytes[p++] !== 0;
    const onActivateRaw  = readU16(bytes, p); p += 2;
    const onDeactivateRaw = readU16(bytes, p); p += 2;

    const stateType = STATE_TYPE_MAP[stateTypeByte];
    if (stateType === undefined) throw new Error(`Unknown state_type byte: 0x${stateTypeByte.toString(16)}`);

    const { value: name, nextOffset: afterName } = readNullTerminated(bytes, p);
    p = afterName;

    const physCount = bytes[p++];
    const physicalButtons: PhysicalButtonConfig[] = [];
    for (let i = 0; i < physCount; i++) {
        const buttonCodeByte = bytes[p++];
        p++; // reserved
        const sequenceId = readU16(bytes, p); p += 2;
        const buttonCode = BYTE_TO_BUTTON_CODE[buttonCodeByte];
        if (buttonCode !== undefined) physicalButtons.push({ buttonCode, sequenceId });
    }

    const screenCount = readU16(bytes, p); p += 2;
    const screenButtons: ScreenButtonConfig[] = [];
    for (let i = 0; i < screenCount; i++) {
        const { value: label, nextOffset: afterLabel } = readNullTerminated(bytes, p);
        p = afterLabel;
        const iconIdRaw  = readU16(bytes, p); p += 2;
        const sequenceId = readU16(bytes, p); p += 2;
        screenButtons.push({
            id:        nextScreenButtonId.value++,
            label,
            icon:      iconIdRaw === 0xFFFF ? undefined : String(iconIdRaw),
            sequenceId,
        });
    }

    return {
        id,
        name,
        stateType,
        buttonFallback,
        physicalButtons,
        screenButtons,
        onActivate:   onActivateRaw  === SEQUENCE_ID_NONE ? null : onActivateRaw,
        onDeactivate: onDeactivateRaw === SEQUENCE_ID_NONE ? null : onDeactivateRaw,
    };
}

function parseSequenceRecord(bytes: Uint8Array, entry: IndexEntry): Sequence {
    let p = entry.dataOffset;

    const id          = readU16(bytes, p); p += 2;
    const actionCount = bytes[p++];

    const actions: Action[] = [];
    for (let i = 0; i < actionCount; i++) {
        // action_type byte placeholder — expand when ActionType enum is defined
        p++; // action_type
        const params: [number, number, number, number] = [bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]];
        p += 4;
        actions.push({ type: 'navigate' as ActionType, params }); // type placeholder
    }

    return { id, actions };
}

function parseMetadata(bytes: Uint8Array, dataOffset: number, dataLength: number): Map<number, string> {
    const names = new Map<number, string>();
    if (dataLength === 0) return names;

    let p = dataOffset;
    const nameCount = readU16(bytes, p); p += 2;

    for (let i = 0; i < nameCount; i++) {
        const seqId = readU16(bytes, p); p += 2;
        const { value: name, nextOffset } = readNullTerminated(bytes, p);
        p = nextOffset;
        names.set(seqId, name);
    }

    return names;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function deserialize(bytes: Uint8Array): RemoteConfig {
    // Validate magic
    for (let i = 0; i < 4; i++) {
        if (bytes[i] !== MAGIC[i]) throw new Error('Invalid file: missing IRIS magic bytes');
    }
    if (bytes[4] !== VERSION) {
        throw new Error(`Unsupported version: 0x${bytes[4].toString(16).padStart(2, '0')} (expected 0x${VERSION.toString(16)})`);
    }

    const rootStateId  = readU16(bytes, 5);
    const sectionCount = readU16(bytes, 7);

    // ── Parse manifest ──
    let statesSection:   { count: number; indexOffset: number } | null = null;
    let seqsSection:     { count: number; indexOffset: number } | null = null;
    let metadataSection: { byteLength: number; dataOffset: number } | null = null;

    let pos = 9; // after header(7) + section_count(2)
    for (let i = 0; i < sectionCount; i++) {
        const typeTag     = bytes[pos];
        const count       = readU16(bytes, pos + 1);
        const indexOffset = readU32(bytes, pos + 3);
        const dataOffset  = readU32(bytes, pos + 7);
        pos += 11;

        if      (typeTag === TYPE_STATES)   statesSection   = { count, indexOffset };
        else if (typeTag === TYPE_SEQS)     seqsSection     = { count, indexOffset };
        else if (typeTag === TYPE_METADATA) metadataSection = { byteLength: count, dataOffset };
        // unknown type tags are silently ignored
    }

    // ── Read sequences ──
    const sequences: Sequence[] = [];
    if (seqsSection && seqsSection.count > 0) {
        const index = readIndex(bytes, seqsSection.indexOffset, seqsSection.count);
        for (const entry of index.entries) {
            sequences.push(parseSequenceRecord(bytes, entry));
        }
    }

    // ── Apply sequence names from metadata ──
    if (metadataSection) {
        const names = parseMetadata(bytes, metadataSection.dataOffset, metadataSection.byteLength);
        for (const seq of sequences) {
            const name = names.get(seq.id);
            if (name !== undefined) seq.name = name;
        }
    }

    // ── Read states ──
    const states: State[] = [];
    const nextScreenButtonId = { value: 1 };
    if (statesSection && statesSection.count > 0) {
        const index = readIndex(bytes, statesSection.indexOffset, statesSection.count);
        for (const entry of index.entries) {
            states.push(parseStateRecord(bytes, entry, nextScreenButtonId));
        }
    }

    return { rootStateId, states, sequences };
}
