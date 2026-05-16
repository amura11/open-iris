import type { RemoteConfig, State, RemoteMetadata } from '@model/state.ts';
import type { Action, Sequence, PhysicalButtonConfig, ScreenButtonConfig } from '@model/actions.ts';
import type { Device, DeviceFunction } from '@model/devices.ts';
import { ButtonCode } from '@model/button-codes.ts';
import {
    MAGIC, VERSION,
    TYPE_STATES, TYPE_SEQS, TYPE_DEVICES, TYPE_FUNCTIONS, TYPE_DATA_BLOCKS, TYPE_METADATA,
    HEADER_SIZE, MANIFEST_ENTRY_SIZE, INDEX_ENTRY_SIZE,
    IRIS_NO_ID, ICON_ID_NONE, METADATA_VERSION,
    IR_PROTOCOL_BYTE, BUTTON_CODE_BYTE, STATE_TYPE_BYTE,
    DEVICE_TYPE_BYTE, POWER_MODE_BYTE,
    ASSIGNMENT_NONE, ASSIGNMENT_SEQUENCE, ASSIGNMENT_ACTION,
} from '@model/serialization.ts';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Record serializers ────────────────────────────────────────────────────────

function serializeAction(action: Action): Uint8Array {
    const buf = new Uint8Array(6); // device_id(2) + function_id(2) + data(2)
    writeU16(buf, 0, action.deviceId);
    writeU16(buf, 2, action.functionId);
    writeU16(buf, 4, action.data);
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

function serializeDeviceRecord(device: Device): Uint8Array {
    // id(2) + type(1) + power_mode(1) + power_on_fn_id(2) + power_off_fn_id(2) + name(null-term)
    const fixed = new Uint8Array(8);
    writeU16(fixed, 0, device.id);
    fixed[2] = DEVICE_TYPE_BYTE[device.type] ?? 0x01;
    fixed[3] = POWER_MODE_BYTE[device.powerMode] ?? 0x00;
    writeU16(fixed, 4, device.powerOnFunctionId  ?? IRIS_NO_ID);
    writeU16(fixed, 6, device.powerOffFunctionId ?? IRIS_NO_ID);
    return concat([fixed, nullTerminated(device.name)]);
}

function serializeFunctionRecord(fn: DeviceFunction): Uint8Array {
    // id(2) + device_id(2) + name(null-term) + data_blob
    const fixed = new Uint8Array(4);
    writeU16(fixed, 0, fn.id);
    writeU16(fixed, 2, fn.deviceId);

    let dataBlob: Uint8Array;
    const { data } = fn;
    if (data.type === 'ir') {
        // protocol(1) + code(8)
        const buf  = new Uint8Array(9);
        const view = new DataView(buf.buffer);
        buf[0] = IR_PROTOCOL_BYTE[data.protocol] ?? 0x01;
        view.setBigUint64(1, data.code, true);
        dataBlob = buf;
    } else {
        // method(1) + url(null-term) + body(null-term)
        const methodByte = ({ GET: 0x01, POST: 0x02, PUT: 0x03, DELETE: 0x04 } as Record<string, number>)[data.method.toUpperCase()] ?? 0x01;
        dataBlob = concat([new Uint8Array([methodByte]), nullTerminated(data.url), nullTerminated(data.body ?? '')]);
    }

    return concat([fixed, nullTerminated(fn.name), dataBlob]);
}

function serializePhysButton(btn: PhysicalButtonConfig): Uint8Array {
    const buttonCodeByte = BUTTON_CODE_BYTE[btn.buttonCode as ButtonCode] ?? 0x00;
    if (btn.assignment.kind === 'sequence') {
        // button_code(1) + assignment_type(1) + seq_id(2)
        const rec = new Uint8Array(4);
        rec[0] = buttonCodeByte;
        rec[1] = ASSIGNMENT_SEQUENCE;
        writeU16(rec, 2, btn.assignment.sequenceId);
        return rec;
    }
    // button_code(1) + assignment_type(1) + device_id(2) + function_id(2) + data(2)
    const rec = new Uint8Array(8);
    rec[0] = buttonCodeByte;
    rec[1] = ASSIGNMENT_ACTION;
    writeU16(rec, 2, btn.assignment.deviceId);
    writeU16(rec, 4, btn.assignment.functionId);
    writeU16(rec, 6, btn.assignment.data);
    return rec;
}

function serializeScreenButton(btn: ScreenButtonConfig): Uint8Array {
    const parts: Uint8Array[] = [];
    parts.push(nullTerminated(btn.label));

    const iconBuf = new Uint8Array(2);
    writeU16(iconBuf, 0, ICON_ID_NONE);
    parts.push(iconBuf);

    if (btn.assignment === null) {
        // assignment_type(1) — no assignment data
        parts.push(new Uint8Array([ASSIGNMENT_NONE]));
    } else if (btn.assignment.kind === 'sequence') {
        // assignment_type(1) + seq_id(2)
        const asgn = new Uint8Array(3);
        asgn[0] = ASSIGNMENT_SEQUENCE;
        writeU16(asgn, 1, btn.assignment.sequenceId);
        parts.push(asgn);
    } else {
        // assignment_type(1) + device_id(2) + function_id(2) + data(2)
        const asgn = new Uint8Array(7);
        asgn[0] = ASSIGNMENT_ACTION;
        writeU16(asgn, 1, btn.assignment.deviceId);
        writeU16(asgn, 3, btn.assignment.functionId);
        writeU16(asgn, 5, btn.assignment.data);
        parts.push(asgn);
    }

    return concat(parts);
}

function serializeStateRecord(state: State): Uint8Array {
    const parts: Uint8Array[] = [];

    // Fixed header: id(2) + state_type(1) + button_fallback(1) + on_activate(2) + on_deactivate(2)
    const header = new Uint8Array(8);
    writeU16(header, 0, state.id);
    header[2] = STATE_TYPE_BYTE[state.stateType] ?? 0x00;
    header[3] = state.buttonFallback ? 1 : 0;
    writeU16(header, 4, state.onActivate   ?? IRIS_NO_ID);
    writeU16(header, 6, state.onDeactivate ?? IRIS_NO_ID);
    parts.push(header);

    parts.push(nullTerminated(state.name));

    // Active devices: count(2) + ids[]
    const activeDevicesBuf = new Uint8Array(2 + state.activeDevices.length * 2);
    writeU16(activeDevicesBuf, 0, state.activeDevices.length);
    state.activeDevices.forEach((id, i) => writeU16(activeDevicesBuf, 2 + i * 2, id));
    parts.push(activeDevicesBuf);

    // Physical buttons (only assigned; phys_count(1))
    const physHeader = new Uint8Array(1);
    physHeader[0] = state.physicalButtons.length;
    parts.push(physHeader);
    for (const phys of state.physicalButtons) {
        parts.push(serializePhysButton(phys));
    }

    // Screen buttons: count(2)
    const screenHeader = new Uint8Array(2);
    writeU16(screenHeader, 0, state.screenButtons.length);
    parts.push(screenHeader);
    for (const btn of state.screenButtons) {
        parts.push(serializeScreenButton(btn));
    }

    return concat(parts);
}

async function compressMetadata(metadata: RemoteMetadata): Promise<Uint8Array> {
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

    const stream = new CompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    writer.write(encoder.encode(json));
    writer.close();

    const chunks: Uint8Array[] = [];
    const reader = stream.readable.getReader();
    while (true) {
        const { done, value } = await reader.read();
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

// ── Public API ────────────────────────────────────────────────────────────────

export async function serialize(config: RemoteConfig): Promise<Uint8Array> {
    const sectionCount = 6; // states, seqs, devices, functions, data_blocks, metadata
    const manifestSize = 2 + sectionCount * MANIFEST_ENTRY_SIZE;

    // Serialize all records
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

    // Compute layout — each indexed section immediately follows the previous
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

    // Header
    const header = new Uint8Array(HEADER_SIZE);
    header.set(MAGIC);
    header[4] = VERSION;
    writeU16(header, 5, config.rootStateId);

    // Manifest
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

    manifest[me] = TYPE_DEVICES;
    writeU16(manifest, me + 1, config.devices.length);
    writeU32(manifest, me + 3, deviceIndexOffset);
    writeU32(manifest, me + 7, 0);
    me += MANIFEST_ENTRY_SIZE;

    manifest[me] = TYPE_FUNCTIONS;
    writeU16(manifest, me + 1, config.functions.length);
    writeU32(manifest, me + 3, fnIndexOffset);
    writeU32(manifest, me + 7, 0);
    me += MANIFEST_ENTRY_SIZE;

    manifest[me] = TYPE_DATA_BLOCKS;
    writeU16(manifest, me + 1, config.dataBlocks.length);
    writeU32(manifest, me + 3, dataBlockIndexOffset);
    writeU32(manifest, me + 7, 0);
    me += MANIFEST_ENTRY_SIZE;

    // Metadata is a blob section: count = compressed byte length, data_offset = section start
    manifest[me] = TYPE_METADATA;
    writeU16(manifest, me + 1, metadataBytes.length);
    writeU32(manifest, me + 3, 0);
    writeU32(manifest, me + 7, metadataOffset);

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
