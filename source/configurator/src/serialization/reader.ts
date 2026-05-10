import type { RemoteConfig, State, ConfiguratorMetadata, JsonObject } from '@model/state.ts';
import type { Sequence, Action, ScreenButtonConfig, PhysicalButtonConfig, IRCode, IRProtocol } from '@model/actions.ts';
import { BYTE_TO_ACTION_TYPE } from '@model/actions.ts';
import type { Device, DeviceFunction, DeviceType } from '@model/devices.ts';
import type { SequenceAnnotation } from '@model/actions.ts';
import {
    MAGIC, VERSION,
    TYPE_STATES, TYPE_SEQS, TYPE_IR_CODES, TYPE_METADATA,
    MANIFEST_ENTRY_SIZE, INDEX_ENTRY_SIZE,
    SEQUENCE_ID_NONE,
    BYTE_TO_IR_PROTOCOL, BYTE_TO_BUTTON_CODE, BYTE_TO_STATE_TYPE,
} from '@model/serialization.ts';

// ── Raw metadata shapes ───────────────────────────────────────────────────────

interface RawIRTemplate {
    type: 'ir_send';
    protocol: IRProtocol;
    code: string;
}

interface RawRESTTemplate {
    type: 'rest_call';
    method: string;
    url: string;
    body?: string;
}

type RawTemplate = RawIRTemplate | RawRESTTemplate;

interface RawDeviceFunction {
    name: string;
    template: RawTemplate;
}

interface RawMetadataDevice {
    id: string;
    name: string;
    manufacturer: string;
    type: DeviceType;
    functions: RawDeviceFunction[];
}

interface RawMetadata {
    version?: number;
    devices: RawMetadataDevice[];
    sequenceAnnotations: SequenceAnnotation[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const decoder = new TextDecoder();

function readU16(bytes: Uint8Array, offset: number): number {
    return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
    return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

interface NullTerminatedResult { value: string; nextOffset: number; }

function readNullTerminated(bytes: Uint8Array, offset: number): NullTerminatedResult {
    let end = offset;

    while (end < bytes.length && bytes[end] !== 0) {
        end++;
    }

    return { value: decoder.decode(bytes.subarray(offset, end)), nextOffset: end + 1 };
}

// ── Section index ─────────────────────────────────────────────────────────────

interface IndexEntry            { id: number; dataOffset: number; dataLength: number; }
interface IndexedSectionManifest { count: number; indexOffset: number; }
interface BlobSectionManifest    { count: number; dataOffset: number; }
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

    const physCount = bytes[p++];
    const physicalButtons: PhysicalButtonConfig[] = [];
    for (let i = 0; i < physCount; i++) {
        const buttonCodeByte = bytes[p++];
        p++; // reserved
        const sequenceId = readU16(bytes, p); p += 2;
        const buttonCode = BYTE_TO_BUTTON_CODE[buttonCodeByte];

        if (buttonCode !== undefined) {
            physicalButtons.push({ buttonCode, sequenceId });
        }
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
        id, name, stateType, buttonFallback, physicalButtons, screenButtons,
        onActivate:   onActivateRaw   === SEQUENCE_ID_NONE ? null : onActivateRaw,
        onDeactivate: onDeactivateRaw === SEQUENCE_ID_NONE ? null : onDeactivateRaw,
    };
}

function parseSequenceRecord(bytes: Uint8Array, entry: IndexEntry): Sequence {
    let p = entry.dataOffset;

    const id          = readU16(bytes, p); p += 2;
    const actionCount = bytes[p++];

    const actions: Action[] = [];
    for (let i = 0; i < actionCount; i++) {
        const typeByte = bytes[p++];
        const params: [number, number, number, number] = [bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]];
        p += 4;
        const type = BYTE_TO_ACTION_TYPE[typeByte] ?? 'navigate';
        actions.push({ type, params });
    }

    return { id, actions };
}

function parseIRCodesSection(bytes: Uint8Array, dataOffset: number, count: number): IRCode[] {
    const codes: IRCode[] = [];
    const view = new DataView(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength);
    let p = dataOffset + 2; // skip the count(2) that's already in the manifest

    for (let i = 0; i < count; i++) {
        const id           = readU16(bytes, p); p += 2;
        const protocolByte = bytes[p++];
        const code         = view.getBigUint64(p, true); p += 8;
        const protocol = BYTE_TO_IR_PROTOCOL[protocolByte];

        if (!protocol) {
            throw new Error(`Unknown IR protocol byte: 0x${protocolByte.toString(16)}`);
        }

        codes.push({ id, protocol, code });
    }

    return codes;
}

async function decompressMetadata(bytes: Uint8Array, dataOffset: number, byteLength: number): Promise<ConfiguratorMetadata> {
    const compressed = bytes.slice(dataOffset, dataOffset + byteLength);

    const stream = new DecompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();

    writer.write(compressed);
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

    const json    = decoder.decode(concatChunks(chunks));
    const rawJson = JSON.parse(json) as JsonObject;
    const raw     = rawJson as unknown as RawMetadata;

    const devices: Device[] = (raw.devices ?? []).map((d): Device => ({
        id:           d.id,
        name:         d.name,
        manufacturer: d.manufacturer,
        type:         d.type,
        functions:    (d.functions ?? []).map((f): DeviceFunction => {
            const template = f.template;

            if (template.type === 'ir_send') {
                return {
                    name:     f.name,
                    template: { type: 'ir_send', protocol: template.protocol, code: BigInt(template.code) },
                };
            }

            return { name: f.name, template };
        }),
    }));

    const sequenceAnnotations: SequenceAnnotation[] = raw.sequenceAnnotations ?? [];

    const { version: _version, devices: _devices, sequenceAnnotations: _sequenceAnnotations, ...extra } = rawJson;

    return { devices, sequenceAnnotations, extra: extra as JsonObject };
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
    const total  = chunks.reduce((s, c) => s + c.length, 0);
    const result = new Uint8Array(total);
    let offset   = 0;
    for (const c of chunks) {
        result.set(c, offset);
        offset += c.length;
    }
    return result;
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

    let statesSection:   IndexedSectionManifest   | null = null;
    let seqsSection:     IndexedSectionManifest   | null = null;
    let irCodesSection:  BlobSectionManifest      | null = null;
    let metadataSection: MetadataSectionManifest  | null = null;

    let pos = 9;
    for (let i = 0; i < sectionCount; i++) {
        const typeTag     = bytes[pos];
        const count       = readU16(bytes, pos + 1);
        const indexOffset = readU32(bytes, pos + 3);
        const dataOffset  = readU32(bytes, pos + 7);
        pos += MANIFEST_ENTRY_SIZE;

        if (typeTag === TYPE_STATES) {
            statesSection = { count, indexOffset };
        } else if (typeTag === TYPE_SEQS) {
            seqsSection = { count, indexOffset };
        } else if (typeTag === TYPE_IR_CODES) {
            irCodesSection = { count, dataOffset };
        } else if (typeTag === TYPE_METADATA) {
            metadataSection = { byteLength: count, dataOffset };
        }
        // unknown section types are silently ignored
    }

    const sequences: Sequence[] = [];
    if (seqsSection && seqsSection.count > 0) {
        const index = readIndex(bytes, seqsSection.indexOffset, seqsSection.count);

        for (const entry of index) {
            sequences.push(parseSequenceRecord(bytes, entry));
        }
    }

    const irCodes: IRCode[] = irCodesSection && irCodesSection.count > 0
        ? parseIRCodesSection(bytes, irCodesSection.dataOffset, irCodesSection.count)
        : [];

    const metadata: ConfiguratorMetadata = metadataSection && metadataSection.byteLength > 0
        ? await decompressMetadata(bytes, metadataSection.dataOffset, metadataSection.byteLength)
        : { devices: [], sequenceAnnotations: [], extra: {} };

    const states: State[] = [];
    const nextScreenButtonId = { value: 1 };
    if (statesSection && statesSection.count > 0) {
        const index = readIndex(bytes, statesSection.indexOffset, statesSection.count);

        for (const entry of index) {
            states.push(parseStateRecord(bytes, entry, nextScreenButtonId));
        }
    }

    return { rootStateId, states, sequences, irCodes, metadata };
}
