import type { RemoteConfig, State, RemoteMetadata, IdCounters, JsonObject } from '@model/state.ts';
import type { Sequence, Action, ScreenButtonConfig, PhysicalButtonConfig } from '@model/actions.ts';
import type { Device, DeviceFunction, DeviceType, DevicePowerMode, DeviceId } from '@model/devices.ts';
import {
    MAGIC, VERSION,
    TYPE_STATES, TYPE_SEQS, TYPE_DEVICES, TYPE_FUNCTIONS, TYPE_DATA_BLOCKS, TYPE_METADATA,
    MANIFEST_ENTRY_SIZE, INDEX_ENTRY_SIZE,
    IRIS_NO_ID,
    BYTE_TO_IR_PROTOCOL, BYTE_TO_BUTTON_CODE, BYTE_TO_STATE_TYPE,
    BYTE_TO_DEVICE_TYPE, BYTE_TO_POWER_MODE,
    ASSIGNMENT_SEQUENCE, ASSIGNMENT_ACTION,
} from '@model/serialization.ts';

// ── Helpers ───────────────────────────────────────────────────────────────────

const decoder = new TextDecoder();

function readU16(bytes: Uint8Array, offset: number): number {
    return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
    return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

interface NullTermResult { value: string; nextOffset: number; }

function readNullTerminated(bytes: Uint8Array, offset: number): NullTermResult {
    let end = offset;
    while (end < bytes.length && bytes[end] !== 0) end++;
    return { value: decoder.decode(bytes.subarray(offset, end)), nextOffset: end + 1 };
}

// ── Section index ─────────────────────────────────────────────────────────────

interface IndexEntry             { id: number; dataOffset: number; dataLength: number; }
interface IndexedSectionManifest { count: number; indexOffset: number; }
interface MetadataSectionManifest { byteLength: number; dataOffset: number; }
interface MutableCounter         { value: number; }

function readIndex(bytes: Uint8Array, indexOffset: number, count: number): IndexEntry[] {
    const entries: IndexEntry[] = [];
    for (let i = 0; i < count; i++) {
        const base = indexOffset + i * INDEX_ENTRY_SIZE;
        entries.push({
            id:         readU16(bytes, base),
            dataOffset: readU32(bytes, base + 2),
            dataLength: readU16(bytes, base + 6),
        });
    }
    return entries;
}

// ── Record parsers ────────────────────────────────────────────────────────────

function parseDeviceRecord(bytes: Uint8Array, entry: IndexEntry): Device {
    let p = entry.dataOffset;
    const id           = readU16(bytes, p); p += 2;
    const typeByte     = bytes[p++];
    const powerByte    = bytes[p++];
    const powerOnFnId  = readU16(bytes, p); p += 2;
    const powerOffFnId = readU16(bytes, p); p += 2;
    const { value: name } = readNullTerminated(bytes, p);

    return {
        id,
        name,
        type:                (BYTE_TO_DEVICE_TYPE[typeByte]  ?? 'ir') as DeviceType,
        powerMode:           (BYTE_TO_POWER_MODE[powerByte]  ?? 'none') as DevicePowerMode,
        powerOnFunctionId:   powerOnFnId  === IRIS_NO_ID ? undefined : powerOnFnId,
        powerOffFunctionId:  powerOffFnId === IRIS_NO_ID ? undefined : powerOffFnId,
    };
}

function parseFunctionRecord(bytes: Uint8Array, entry: IndexEntry, devices: Device[]): DeviceFunction {
    let p = entry.dataOffset;
    const id       = readU16(bytes, p); p += 2;
    const deviceId = readU16(bytes, p); p += 2;
    const { value: name, nextOffset: afterName } = readNullTerminated(bytes, p);
    p = afterName;

    const device    = devices.find(d => d.id === deviceId);
    const endOffset = entry.dataOffset + entry.dataLength;

    let data: DeviceFunction['data'];

    if (!device || device.type === 'ir') {
        const protocolByte = bytes[p++];
        const view = new DataView(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength);
        const code = view.getBigUint64(p, true);
        data = { type: 'ir', protocol: BYTE_TO_IR_PROTOCOL[protocolByte] ?? 'nec', code };
    } else if (device.type === 'rest') {
        const methodByte = bytes[p++];
        const methodMap: Record<number, string> = { 0x01: 'GET', 0x02: 'POST', 0x03: 'PUT', 0x04: 'DELETE' };
        const { value: url, nextOffset: afterUrl } = readNullTerminated(bytes, p);
        p = afterUrl;
        const { value: body } = readNullTerminated(bytes, p);
        data = { type: 'rest', method: methodMap[methodByte] ?? 'GET', url, body: body || undefined };
    } else {
        // matter or unknown — store as ir placeholder
        data = { type: 'ir', protocol: 'nec', code: 0n };
    }

    void endOffset; // not needed; DataView read from absolute byte offsets in the full buffer
    return { id, deviceId, name, data };
}

function parseSequenceRecord(bytes: Uint8Array, entry: IndexEntry): Sequence {
    let p = entry.dataOffset;
    const id          = readU16(bytes, p); p += 2;
    const actionCount = bytes[p++];

    const actions: Action[] = [];
    for (let i = 0; i < actionCount; i++) {
        const deviceId   = readU16(bytes, p); p += 2;
        const functionId = readU16(bytes, p); p += 2;
        const data       = readU16(bytes, p); p += 2;
        actions.push({ deviceId, functionId, data });
    }
    return { id, actions };
}

function parseStateRecord(bytes: Uint8Array, entry: IndexEntry, nextScreenButtonId: MutableCounter): State {
    let p = entry.dataOffset;

    const id              = readU16(bytes, p); p += 2;
    const stateTypeByte   = bytes[p++];
    const buttonFallback  = bytes[p++] !== 0;
    const onActivateRaw   = readU16(bytes, p); p += 2;
    const onDeactivateRaw = readU16(bytes, p); p += 2;

    const stateType = BYTE_TO_STATE_TYPE[stateTypeByte];
    if (stateType === undefined) {
        throw new Error(`Unknown state_type byte: 0x${stateTypeByte.toString(16)}`);
    }

    const { value: name, nextOffset: afterName } = readNullTerminated(bytes, p);
    p = afterName;

    // Active devices
    const activeDeviceCount = readU16(bytes, p); p += 2;
    const activeDevices: DeviceId[] = [];
    for (let i = 0; i < activeDeviceCount; i++) {
        activeDevices.push(readU16(bytes, p)); p += 2;
    }

    // Physical buttons
    const physCount = bytes[p++];
    const physicalButtons: PhysicalButtonConfig[] = [];
    for (let i = 0; i < physCount; i++) {
        const buttonCodeByte = bytes[p++];
        const assignType     = bytes[p++];
        const buttonCode     = BYTE_TO_BUTTON_CODE[buttonCodeByte];

        let assignment: PhysicalButtonConfig['assignment'];
        if (assignType === ASSIGNMENT_SEQUENCE) {
            const sequenceId = readU16(bytes, p); p += 2;
            assignment = { kind: 'sequence', sequenceId };
        } else {
            // ASSIGNMENT_ACTION
            const deviceId   = readU16(bytes, p); p += 2;
            const functionId = readU16(bytes, p); p += 2;
            const data       = readU16(bytes, p); p += 2;
            assignment = { kind: 'action', deviceId, functionId, data };
        }

        if (buttonCode !== undefined) {
            physicalButtons.push({ buttonCode, assignment });
        }
    }

    // Screen buttons
    const screenCount = readU16(bytes, p); p += 2;
    const screenButtons: ScreenButtonConfig[] = [];
    for (let i = 0; i < screenCount; i++) {
        const { value: label, nextOffset: afterLabel } = readNullTerminated(bytes, p);
        p = afterLabel;
        const iconIdRaw  = readU16(bytes, p); p += 2;
        const assignType = bytes[p++];

        let assignment: ScreenButtonConfig['assignment'] = null;
        if (assignType === ASSIGNMENT_SEQUENCE) {
            const sequenceId = readU16(bytes, p); p += 2;
            assignment = { kind: 'sequence', sequenceId };
        } else if (assignType === ASSIGNMENT_ACTION) {
            const deviceId   = readU16(bytes, p); p += 2;
            const functionId = readU16(bytes, p); p += 2;
            const data       = readU16(bytes, p); p += 2;
            assignment = { kind: 'action', deviceId, functionId, data };
        }

        screenButtons.push({
            id:    nextScreenButtonId.value++,
            label,
            icon:  iconIdRaw === IRIS_NO_ID ? undefined : String(iconIdRaw),
            assignment,
        });
    }

    return {
        id, name, stateType, buttonFallback, physicalButtons, screenButtons, activeDevices,
        onActivate:   onActivateRaw   === IRIS_NO_ID ? null : onActivateRaw,
        onDeactivate: onDeactivateRaw === IRIS_NO_ID ? null : onDeactivateRaw,
    };
}

// ── Metadata decompressor ─────────────────────────────────────────────────────

async function decompressMetadata(bytes: Uint8Array, dataOffset: number, byteLength: number): Promise<RemoteMetadata> {
    const compressed = bytes.slice(dataOffset, dataOffset + byteLength);

    const stream = new DecompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    writer.write(compressed);
    writer.close();

    const chunks: Uint8Array[] = [];
    const reader = stream.readable.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }

    const total = chunks.reduce((s, c) => s + c.length, 0);
    const buf   = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { buf.set(c, off); off += c.length; }

    const raw = JSON.parse(decoder.decode(buf)) as JsonObject;

    const defaultCounters: IdCounters = { device: 0, function: 0, sequence: 0, state: 1, dataBlock: 0 };

    const idCounters       = (raw.idCounters        as unknown as IdCounters)                          ?? defaultCounters;
    const deviceMetadata   = (raw.deviceMetadata    as unknown as RemoteMetadata['deviceMetadata'])   ?? [];
    const functionMetadata = (raw.functionMetadata  as unknown as RemoteMetadata['functionMetadata']) ?? [];
    const sequenceMetadata = (raw.sequenceMetadata  as unknown as RemoteMetadata['sequenceMetadata']) ?? [];

    const { version: _v, idCounters: _ic, deviceMetadata: _dm, functionMetadata: _fm, sequenceMetadata: _sm, ...extra } = raw;

    return { idCounters, deviceMetadata, functionMetadata, sequenceMetadata, extra: extra as JsonObject };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function deserialize(bytes: Uint8Array): Promise<RemoteConfig> {
    for (let i = 0; i < 4; i++) {
        if (bytes[i] !== MAGIC[i]) {
            throw new Error('Invalid file: missing IRIS magic bytes');
        }
    }
    if (bytes[4] !== VERSION) {
        throw new Error(`Unsupported version: 0x${bytes[4].toString(16).padStart(2, '0')} (expected 0x${VERSION.toString(16)})`);
    }

    const rootStateId  = readU16(bytes, 5);
    const sectionCount = readU16(bytes, 7);

    let statesSection:    IndexedSectionManifest  | null = null;
    let seqsSection:      IndexedSectionManifest  | null = null;
    let devicesSection:   IndexedSectionManifest  | null = null;
    let functionsSection: IndexedSectionManifest  | null = null;
    let dataBlocksSection: IndexedSectionManifest | null = null;
    let metadataSection:  MetadataSectionManifest | null = null;

    let pos = 9;
    for (let i = 0; i < sectionCount; i++) {
        const typeTag     = bytes[pos];
        const count       = readU16(bytes, pos + 1);
        const indexOffset = readU32(bytes, pos + 3);
        const dataOffset  = readU32(bytes, pos + 7);
        pos += MANIFEST_ENTRY_SIZE;

        if      (typeTag === TYPE_STATES)      statesSection    = { count, indexOffset };
        else if (typeTag === TYPE_SEQS)        seqsSection      = { count, indexOffset };
        else if (typeTag === TYPE_DEVICES)     devicesSection   = { count, indexOffset };
        else if (typeTag === TYPE_FUNCTIONS)   functionsSection = { count, indexOffset };
        else if (typeTag === TYPE_DATA_BLOCKS) dataBlocksSection = { count, indexOffset };
        else if (typeTag === TYPE_METADATA)    metadataSection  = { byteLength: count, dataOffset };
        // unknown section types are silently ignored
    }

    // Devices must be parsed before functions (needed for type-specific data parsing)
    const devices: Device[] = [];
    if (devicesSection && devicesSection.count > 0) {
        const index = readIndex(bytes, devicesSection.indexOffset, devicesSection.count);
        for (const entry of index) {
            devices.push(parseDeviceRecord(bytes, entry));
        }
    }

    const functions: DeviceFunction[] = [];
    if (functionsSection && functionsSection.count > 0) {
        const index = readIndex(bytes, functionsSection.indexOffset, functionsSection.count);
        for (const entry of index) {
            functions.push(parseFunctionRecord(bytes, entry, devices));
        }
    }

    const sequences: Sequence[] = [];
    if (seqsSection && seqsSection.count > 0) {
        const index = readIndex(bytes, seqsSection.indexOffset, seqsSection.count);
        for (const entry of index) {
            sequences.push(parseSequenceRecord(bytes, entry));
        }
    }

    const dataBlocks: RemoteConfig['dataBlocks'] = [];
    if (dataBlocksSection && dataBlocksSection.count > 0) {
        const index = readIndex(bytes, dataBlocksSection.indexOffset, dataBlocksSection.count);
        for (const entry of index) {
            const id   = readU16(bytes, entry.dataOffset);
            const data = bytes.slice(entry.dataOffset + 2, entry.dataOffset + entry.dataLength);
            dataBlocks.push({ id, data });
        }
    }

    const defaultMeta: RemoteMetadata = {
        idCounters:       { device: 0, function: 0, sequence: 0, state: 1, dataBlock: 0 },
        deviceMetadata:   [],
        functionMetadata: [],
        sequenceMetadata: [],
        extra:            {},
    };

    const metadata: RemoteMetadata = metadataSection && metadataSection.byteLength > 0
        ? await decompressMetadata(bytes, metadataSection.dataOffset, metadataSection.byteLength)
        : defaultMeta;

    const states: State[] = [];
    const nextScreenButtonId = { value: 1 };
    if (statesSection && statesSection.count > 0) {
        const index = readIndex(bytes, statesSection.indexOffset, statesSection.count);
        for (const entry of index) {
            states.push(parseStateRecord(bytes, entry, nextScreenButtonId));
        }
    }

    return { rootStateId, states, sequences, devices, functions, dataBlocks, metadata };
}
