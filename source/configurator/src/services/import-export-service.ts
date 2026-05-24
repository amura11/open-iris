import type { WireConfig, WireState, WireDevice, WireDeviceFunction, WireSequence, WireMetadata, WireIdCounters, WireJsonObject } from '@model/wire-types.ts';
import type { StateType, DeviceType, DevicePowerMode, StateId, SequenceId, ScreenButtonId, DeviceId, FunctionId } from '@model/configurator-types.ts';
import type { ButtonCode } from '@model/button-codes.ts';
import {
    MAGIC, VERSION,
    TYPE_STATES, TYPE_SEQS, TYPE_DEVICES, TYPE_FUNCTIONS, TYPE_DATA_BLOCKS, TYPE_METADATA,
    HEADER_SIZE, MANIFEST_ENTRY_SIZE, INDEX_ENTRY_SIZE,
    IRIS_NO_ID, ICON_ID_NONE, METADATA_VERSION,
    IR_PROTOCOL_BYTE, BUTTON_CODE_BYTE, STATE_TYPE_BYTE,
    DEVICE_TYPE_BYTE, POWER_MODE_BYTE,
    ASSIGNMENT_NONE, ASSIGNMENT_SEQUENCE, ASSIGNMENT_ACTION,
    BYTE_TO_IR_PROTOCOL, BYTE_TO_BUTTON_CODE, BYTE_TO_STATE_TYPE,
    BYTE_TO_DEVICE_TYPE, BYTE_TO_POWER_MODE,
} from '@model/serialization.ts';

// ── Shared helpers ────────────────────────────────────────────────────────────

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ── Write helpers ─────────────────────────────────────────────────────────────

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

// ── Read helpers ──────────────────────────────────────────────────────────────

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

// ── Record serializers ────────────────────────────────────────────────────────

function serializeAction(action: WireSequence['actions'][number]): Uint8Array {
    const buf = new Uint8Array(6);
    writeU16(buf, 0, action.deviceId);
    writeU16(buf, 2, action.functionId);
    writeU16(buf, 4, action.data);
    return buf;
}

function serializeSequenceRecord(seq: WireSequence): Uint8Array {
    const parts: Uint8Array[] = [];
    const header = new Uint8Array(3);
    writeU16(header, 0, seq.id);
    header[2] = seq.actions.length;
    parts.push(header);

    for (const action of seq.actions) {
        parts.push(serializeAction(action));
    }

    return concat(parts);
}

function serializeDeviceRecord(device: WireDevice): Uint8Array {
    const fixed = new Uint8Array(8);
    writeU16(fixed, 0, device.id);
    fixed[2] = DEVICE_TYPE_BYTE[device.type] ?? 0x01;
    fixed[3] = POWER_MODE_BYTE[device.powerMode] ?? 0x00;
    writeU16(fixed, 4, device.powerOnFunctionId  ?? IRIS_NO_ID);
    writeU16(fixed, 6, device.powerOffFunctionId ?? IRIS_NO_ID);
    return concat([fixed, nullTerminated(device.name)]);
}

function serializeFunctionRecord(fn: WireDeviceFunction): Uint8Array {
    const fixed = new Uint8Array(4);
    writeU16(fixed, 0, fn.id);
    writeU16(fixed, 2, fn.deviceId);

    let dataBlob: Uint8Array;
    const { data } = fn;

    if (data.type === 'ir') {
        const buf  = new Uint8Array(9);
        const view = new DataView(buf.buffer);
        buf[0] = IR_PROTOCOL_BYTE[data.protocol] ?? 0x01;
        view.setBigUint64(1, data.code, true);
        dataBlob = buf;
    } else {
        const methodByte = ({ GET: 0x01, POST: 0x02, PUT: 0x03, DELETE: 0x04 } as Record<string, number>)[data.method.toUpperCase()] ?? 0x01;
        dataBlob = concat([new Uint8Array([methodByte]), nullTerminated(data.url), nullTerminated(data.body ?? '')]);
    }

    return concat([fixed, nullTerminated(fn.name), dataBlob]);
}

function serializePhysButton(btn: WireState['physicalButtons'][number]): Uint8Array {
    const buttonCodeByte = BUTTON_CODE_BYTE[btn.buttonCode as ButtonCode] ?? 0x00;

    if (btn.assignment.kind === 'sequence') {
        const rec = new Uint8Array(4);
        rec[0] = buttonCodeByte;
        rec[1] = ASSIGNMENT_SEQUENCE;
        writeU16(rec, 2, btn.assignment.sequenceId);
        return rec;
    }

    const rec = new Uint8Array(8);
    rec[0] = buttonCodeByte;
    rec[1] = ASSIGNMENT_ACTION;
    writeU16(rec, 2, btn.assignment.deviceId);
    writeU16(rec, 4, btn.assignment.functionId);
    writeU16(rec, 6, btn.assignment.data);
    return rec;
}

function serializeScreenButton(btn: WireState['screenButtons'][number]): Uint8Array {
    const parts: Uint8Array[] = [];
    parts.push(nullTerminated(btn.label));

    const iconBuf = new Uint8Array(2);
    writeU16(iconBuf, 0, ICON_ID_NONE);
    parts.push(iconBuf);

    if (btn.assignment === null) {
        parts.push(new Uint8Array([ASSIGNMENT_NONE]));
    } else if (btn.assignment.kind === 'sequence') {
        const asgn = new Uint8Array(3);
        asgn[0] = ASSIGNMENT_SEQUENCE;
        writeU16(asgn, 1, btn.assignment.sequenceId);
        parts.push(asgn);
    } else {
        const asgn = new Uint8Array(7);
        asgn[0] = ASSIGNMENT_ACTION;
        writeU16(asgn, 1, btn.assignment.deviceId);
        writeU16(asgn, 3, btn.assignment.functionId);
        writeU16(asgn, 5, btn.assignment.data);
        parts.push(asgn);
    }

    return concat(parts);
}

function serializeStateRecord(state: WireState): Uint8Array {
    const parts: Uint8Array[] = [];

    const header = new Uint8Array(8);
    writeU16(header, 0, state.id);
    header[2] = STATE_TYPE_BYTE[state.stateType] ?? 0x00;
    header[3] = state.buttonFallback ? 1 : 0;
    writeU16(header, 4, state.onActivate   ?? IRIS_NO_ID);
    writeU16(header, 6, state.onDeactivate ?? IRIS_NO_ID);
    parts.push(header);

    parts.push(nullTerminated(state.name));

    const activeDevicesBuf = new Uint8Array(2 + state.activeDevices.length * 2);
    writeU16(activeDevicesBuf, 0, state.activeDevices.length);
    state.activeDevices.forEach((id, i) => writeU16(activeDevicesBuf, 2 + i * 2, id));
    parts.push(activeDevicesBuf);

    const physHeader = new Uint8Array(1);
    physHeader[0] = state.physicalButtons.length;
    parts.push(physHeader);

    for (const phys of state.physicalButtons) {
        parts.push(serializePhysButton(phys));
    }

    const screenHeader = new Uint8Array(2);
    writeU16(screenHeader, 0, state.screenButtons.length);
    parts.push(screenHeader);

    for (const btn of state.screenButtons) {
        parts.push(serializeScreenButton(btn));
    }

    return concat(parts);
}

async function compressMetadata(metadata: WireMetadata): Promise<Uint8Array> {
    const payload = {
        version:          METADATA_VERSION,
        ...metadata.extra,
        idCounters:       metadata.idCounters,
        deviceMetadata:   metadata.deviceMetadata,
        functionMetadata: metadata.functionMetadata,
        sequenceMetadata: metadata.sequenceMetadata,
    };

    const json = JSON.stringify(
        payload,
        (_, value) => typeof value === 'bigint' ? '0x' + value.toString(16) : value,
    );

    const compressionStream = new CompressionStream('deflate-raw');
    const streamWriter      = compressionStream.writable.getWriter();
    streamWriter.write(encoder.encode(json));
    streamWriter.close();

    const chunks: Uint8Array[] = [];
    const streamReader = compressionStream.readable.getReader();

    while (true) {
        const { done, value } = await streamReader.read();
        if (done) break;
        chunks.push(value);
    }

    return concat(chunks);
}

// ── Index builder ─────────────────────────────────────────────────────────────

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

// ── Record parsers ────────────────────────────────────────────────────────────

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

function parseDeviceRecord(bytes: Uint8Array, entry: IndexEntry): WireDevice {
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
        type:               (BYTE_TO_DEVICE_TYPE[typeByte]  ?? 'ir') as DeviceType,
        powerMode:          (BYTE_TO_POWER_MODE[powerByte]  ?? 'none') as DevicePowerMode,
        powerOnFunctionId:  powerOnFnId  === IRIS_NO_ID ? undefined : powerOnFnId,
        powerOffFunctionId: powerOffFnId === IRIS_NO_ID ? undefined : powerOffFnId,
    };
}

function parseFunctionRecord(bytes: Uint8Array, entry: IndexEntry, devices: WireDevice[]): WireDeviceFunction {
    let p = entry.dataOffset;
    const id       = readU16(bytes, p); p += 2;
    const deviceId = readU16(bytes, p); p += 2;
    const { value: name, nextOffset: afterName } = readNullTerminated(bytes, p);
    p = afterName;

    const device    = devices.find(d => d.id === deviceId);
    const endOffset = entry.dataOffset + entry.dataLength;

    let data: WireDeviceFunction['data'];

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
        data = { type: 'ir', protocol: 'nec', code: 0n };
    }

    void endOffset;
    return { id, deviceId, name, data };
}

function parseSequenceRecord(bytes: Uint8Array, entry: IndexEntry): WireSequence {
    let p = entry.dataOffset;
    const id          = readU16(bytes, p); p += 2;
    const actionCount = bytes[p++];

    const actions: WireSequence['actions'] = [];

    for (let i = 0; i < actionCount; i++) {
        const deviceId   = readU16(bytes, p); p += 2;
        const functionId = readU16(bytes, p); p += 2;
        const data       = readU16(bytes, p); p += 2;
        actions.push({ deviceId, functionId, data });
    }

    return { id, actions };
}

function parseStateRecord(bytes: Uint8Array, entry: IndexEntry, nextScreenButtonId: MutableCounter): WireState {
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

    const activeDeviceCount = readU16(bytes, p); p += 2;
    const activeDevices: DeviceId[] = [];

    for (let i = 0; i < activeDeviceCount; i++) {
        activeDevices.push(readU16(bytes, p)); p += 2;
    }

    const physCount = bytes[p++];
    const physicalButtons: WireState['physicalButtons'] = [];

    for (let i = 0; i < physCount; i++) {
        const buttonCodeByte = bytes[p++];
        const assignType     = bytes[p++];
        const buttonCode     = BYTE_TO_BUTTON_CODE[buttonCodeByte];

        let assignment: WireState['physicalButtons'][number]['assignment'];

        if (assignType === ASSIGNMENT_SEQUENCE) {
            const sequenceId = readU16(bytes, p); p += 2;
            assignment = { kind: 'sequence', sequenceId };
        } else {
            const deviceId   = readU16(bytes, p); p += 2;
            const functionId = readU16(bytes, p); p += 2;
            const data       = readU16(bytes, p); p += 2;
            assignment = { kind: 'action', deviceId, functionId, data };
        }

        if (buttonCode !== undefined) {
            physicalButtons.push({ buttonCode, assignment });
        }
    }

    const screenCount = readU16(bytes, p); p += 2;
    const screenButtons: WireState['screenButtons'] = [];

    for (let i = 0; i < screenCount; i++) {
        const { value: label, nextOffset: afterLabel } = readNullTerminated(bytes, p);
        p = afterLabel;
        const iconIdRaw  = readU16(bytes, p); p += 2;
        const assignType = bytes[p++];

        let assignment: WireState['screenButtons'][number]['assignment'] = null;

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
            id:         nextScreenButtonId.value++,
            label,
            icon:       iconIdRaw === IRIS_NO_ID ? undefined : String(iconIdRaw),
            assignment,
        });
    }

    return {
        id, name, stateType: stateType as StateType, buttonFallback, physicalButtons, screenButtons, activeDevices,
        onActivate:   onActivateRaw   === IRIS_NO_ID ? null : onActivateRaw   as SequenceId,
        onDeactivate: onDeactivateRaw === IRIS_NO_ID ? null : onDeactivateRaw as SequenceId,
    };
}

// ── Metadata decompressor ─────────────────────────────────────────────────────

async function decompressMetadata(bytes: Uint8Array, dataOffset: number, byteLength: number): Promise<WireMetadata> {
    const compressed = bytes.slice(dataOffset, dataOffset + byteLength);

    const decompressionStream = new DecompressionStream('deflate-raw');
    const streamWriter        = decompressionStream.writable.getWriter();
    streamWriter.write(compressed);
    streamWriter.close();

    const chunks: Uint8Array[] = [];
    const streamReader         = decompressionStream.readable.getReader();

    while (true) {
        const { done, value } = await streamReader.read();
        if (done) break;
        chunks.push(value);
    }

    const total = chunks.reduce((s, c) => s + c.length, 0);
    const buf   = new Uint8Array(total);
    let off = 0;

    for (const c of chunks) { buf.set(c, off); off += c.length; }

    const raw = JSON.parse(decoder.decode(buf)) as WireJsonObject;

    const defaultCounters: WireIdCounters = { device: 0, function: 0, sequence: 0, state: 1, dataBlock: 0 };

    const idCounters       = (raw.idCounters        as unknown as WireIdCounters)                      ?? defaultCounters;
    const deviceMetadata   = (raw.deviceMetadata    as unknown as WireMetadata['deviceMetadata'])   ?? [];
    const functionMetadata = (raw.functionMetadata  as unknown as WireMetadata['functionMetadata']) ?? [];
    const sequenceMetadata = (raw.sequenceMetadata  as unknown as WireMetadata['sequenceMetadata']) ?? [];

    const { version: _version, idCounters: _idCounters, deviceMetadata: _deviceMeta, functionMetadata: _fnMeta, sequenceMetadata: _seqMeta, ...extra } = raw;

    return { idCounters, deviceMetadata, functionMetadata, sequenceMetadata, extra: extra as WireJsonObject };
}

// ── Public API ────────────────────────────────────────────────────────────────

async function serializeConfig(config: WireConfig): Promise<Uint8Array> {
    const sectionCount = 6;
    const manifestSize = 2 + sectionCount * MANIFEST_ENTRY_SIZE;

    const stateRecords:     IndexedRecord[] = config.states.map(s => ({ id: s.id, data: serializeStateRecord(s) }));
    const seqRecords:       IndexedRecord[] = config.sequences.map(s => ({ id: s.id, data: serializeSequenceRecord(s) }));
    const deviceRecords:    IndexedRecord[] = config.devices.map(d => ({ id: d.id, data: serializeDeviceRecord(d) }));
    const fnRecords:        IndexedRecord[] = config.functions.map(f => ({ id: f.id, data: serializeFunctionRecord(f) }));
    const dataBlockRecords: IndexedRecord[] = config.dataBlocks.map(b => {
        const rec = new Uint8Array(2 + b.data.length);
        writeU16(rec, 0, b.id);
        rec.set(b.data, 2);
        return { id: b.id, data: rec };
    });
    const metadataBytes = await compressMetadata(config.metadata);

    const stateIndexOffset     = HEADER_SIZE + manifestSize;
    const { index: stateIndex, data: stateData } = buildIndex(stateRecords, stateIndexOffset);

    const seqIndexOffset       = stateIndexOffset     + stateIndex.length     + stateData.length;
    const { index: seqIndex, data: seqData } = buildIndex(seqRecords, seqIndexOffset);

    const deviceIndexOffset    = seqIndexOffset       + seqIndex.length       + seqData.length;
    const { index: deviceIndex, data: deviceData } = buildIndex(deviceRecords, deviceIndexOffset);

    const fnIndexOffset        = deviceIndexOffset    + deviceIndex.length    + deviceData.length;
    const { index: fnIndex, data: fnData } = buildIndex(fnRecords, fnIndexOffset);

    const dataBlockIndexOffset = fnIndexOffset        + fnIndex.length        + fnData.length;
    const { index: dataBlockIndex, data: dataBlockData } = buildIndex(dataBlockRecords, dataBlockIndexOffset);

    const metadataOffset       = dataBlockIndexOffset + dataBlockIndex.length + dataBlockData.length;

    const header = new Uint8Array(HEADER_SIZE);
    header.set(MAGIC);
    header[4] = VERSION;
    writeU16(header, 5, config.rootStateId);

    const manifest = new Uint8Array(2 + sectionCount * MANIFEST_ENTRY_SIZE);
    writeU16(manifest, 0, sectionCount);
    let manifestEntry = 2;

    manifest[manifestEntry] = TYPE_STATES;
    writeU16(manifest, manifestEntry + 1, config.states.length);
    writeU32(manifest, manifestEntry + 3, stateIndexOffset);
    writeU32(manifest, manifestEntry + 7, 0);
    manifestEntry += MANIFEST_ENTRY_SIZE;

    manifest[manifestEntry] = TYPE_SEQS;
    writeU16(manifest, manifestEntry + 1, config.sequences.length);
    writeU32(manifest, manifestEntry + 3, seqIndexOffset);
    writeU32(manifest, manifestEntry + 7, 0);
    manifestEntry += MANIFEST_ENTRY_SIZE;

    manifest[manifestEntry] = TYPE_DEVICES;
    writeU16(manifest, manifestEntry + 1, config.devices.length);
    writeU32(manifest, manifestEntry + 3, deviceIndexOffset);
    writeU32(manifest, manifestEntry + 7, 0);
    manifestEntry += MANIFEST_ENTRY_SIZE;

    manifest[manifestEntry] = TYPE_FUNCTIONS;
    writeU16(manifest, manifestEntry + 1, config.functions.length);
    writeU32(manifest, manifestEntry + 3, fnIndexOffset);
    writeU32(manifest, manifestEntry + 7, 0);
    manifestEntry += MANIFEST_ENTRY_SIZE;

    manifest[manifestEntry] = TYPE_DATA_BLOCKS;
    writeU16(manifest, manifestEntry + 1, config.dataBlocks.length);
    writeU32(manifest, manifestEntry + 3, dataBlockIndexOffset);
    writeU32(manifest, manifestEntry + 7, 0);
    manifestEntry += MANIFEST_ENTRY_SIZE;

    manifest[manifestEntry] = TYPE_METADATA;
    writeU16(manifest, manifestEntry + 1, metadataBytes.length);
    writeU32(manifest, manifestEntry + 3, 0);
    writeU32(manifest, manifestEntry + 7, metadataOffset);

    return concat([
        header, manifest,
        stateIndex, stateData,
        seqIndex,   seqData,
        deviceIndex, deviceData,
        fnIndex,    fnData,
        dataBlockIndex, dataBlockData,
        metadataBytes,
    ]);
}

async function deserializeConfig(bytes: Uint8Array): Promise<WireConfig> {
    for (let i = 0; i < 4; i++) {
        if (bytes[i] !== MAGIC[i]) {
            throw new Error('Invalid file: missing IRIS magic bytes');
        }
    }

    if (bytes[4] !== VERSION) {
        throw new Error(`Unsupported version: 0x${bytes[4].toString(16).padStart(2, '0')} (expected 0x${VERSION.toString(16)})`);
    }

    const rootStateId  = readU16(bytes, 5) as StateId;
    const sectionCount = readU16(bytes, 7);

    let statesSection:     IndexedSectionManifest  | null = null;
    let seqsSection:       IndexedSectionManifest  | null = null;
    let devicesSection:    IndexedSectionManifest  | null = null;
    let functionsSection:  IndexedSectionManifest  | null = null;
    let dataBlocksSection: IndexedSectionManifest  | null = null;
    let metadataSection:   MetadataSectionManifest | null = null;

    let pos = 9;

    for (let i = 0; i < sectionCount; i++) {
        const typeTag     = bytes[pos];
        const count       = readU16(bytes, pos + 1);
        const indexOffset = readU32(bytes, pos + 3);
        const dataOffset  = readU32(bytes, pos + 7);
        pos += MANIFEST_ENTRY_SIZE;

        if      (typeTag === TYPE_STATES)      { statesSection     = { count, indexOffset }; }
        else if (typeTag === TYPE_SEQS)        { seqsSection       = { count, indexOffset }; }
        else if (typeTag === TYPE_DEVICES)     { devicesSection    = { count, indexOffset }; }
        else if (typeTag === TYPE_FUNCTIONS)   { functionsSection  = { count, indexOffset }; }
        else if (typeTag === TYPE_DATA_BLOCKS) { dataBlocksSection = { count, indexOffset }; }
        else if (typeTag === TYPE_METADATA)    { metadataSection   = { byteLength: count, dataOffset }; }
    }

    const wireDevices: WireDevice[] = [];

    if (devicesSection && devicesSection.count > 0) {
        const index = readIndex(bytes, devicesSection.indexOffset, devicesSection.count);

        for (const entry of index) {
            wireDevices.push(parseDeviceRecord(bytes, entry));
        }
    }

    const wireFunctions: WireDeviceFunction[] = [];

    if (functionsSection && functionsSection.count > 0) {
        const index = readIndex(bytes, functionsSection.indexOffset, functionsSection.count);

        for (const entry of index) {
            wireFunctions.push(parseFunctionRecord(bytes, entry, wireDevices));
        }
    }

    const wireSequences: WireSequence[] = [];

    if (seqsSection && seqsSection.count > 0) {
        const index = readIndex(bytes, seqsSection.indexOffset, seqsSection.count);

        for (const entry of index) {
            wireSequences.push(parseSequenceRecord(bytes, entry));
        }
    }

    const wireDataBlocks: WireConfig['dataBlocks'] = [];

    if (dataBlocksSection && dataBlocksSection.count > 0) {
        const index = readIndex(bytes, dataBlocksSection.indexOffset, dataBlocksSection.count);

        for (const entry of index) {
            const id   = readU16(bytes, entry.dataOffset);
            const data = bytes.slice(entry.dataOffset + 2, entry.dataOffset + entry.dataLength);
            wireDataBlocks.push({ id, data });
        }
    }

    const defaultMeta: WireMetadata = {
        idCounters:       { device: 0, function: 0, sequence: 0, state: 1, dataBlock: 0 },
        deviceMetadata:   [],
        functionMetadata: [],
        sequenceMetadata: [],
        extra:            {},
    };

    const metadata: WireMetadata = metadataSection && metadataSection.byteLength > 0
        ? await decompressMetadata(bytes, metadataSection.dataOffset, metadataSection.byteLength)
        : defaultMeta;

    const wireStates: WireState[] = [];
    const nextScreenButtonId = { value: 1 };

    if (statesSection && statesSection.count > 0) {
        const index = readIndex(bytes, statesSection.indexOffset, statesSection.count);

        for (const entry of index) {
            wireStates.push(parseStateRecord(bytes, entry, nextScreenButtonId));
        }
    }

    return {
        rootStateId,
        states:     wireStates,
        sequences:  wireSequences,
        devices:    wireDevices,
        functions:  wireFunctions,
        dataBlocks: wireDataBlocks,
        metadata,
    };
}

export class ImportExportService {
    async serialize(config: WireConfig): Promise<Uint8Array> {
        return serializeConfig(config);
    }

    async deserialize(bytes: Uint8Array): Promise<WireConfig> {
        return deserializeConfig(bytes);
    }
}
