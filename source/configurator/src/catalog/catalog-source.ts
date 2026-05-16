import type { DeviceType } from '@model/devices.ts';
import type { FunctionData, IRProtocol } from '@model/actions.ts';
import rawCatalog from './devices.json';

export interface CatalogDeviceFunction {
    name:      string;
    data:      FunctionData;
    sourceId?: string;   // e.g. hex string of IR code value
}

export interface CatalogDevice {
    sourceId:     string;        // catalog identifier (was Device.id)
    name:         string;
    manufacturer: string;        // moves to DeviceMetadata on add
    type:         DeviceType;
    functions:    CatalogDeviceFunction[];
}

export interface CatalogSource {
    search(query: string): Promise<CatalogDevice[]>;
}

// Raw JSON shapes — codes are hex strings because JSON cannot represent bigint
interface RawIRTemplate {
    type: 'ir_send';
    protocol: IRProtocol;
    code: string; // hex string e.g. "0xE0E040BF"
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

interface RawDevice {
    id: string;
    name: string;
    manufacturer: string;
    type: DeviceType;
    functions: RawDeviceFunction[];
}

function parseFunction(raw: RawDeviceFunction): CatalogDeviceFunction {
    const t = raw.template;
    if (t.type === 'ir_send') {
        const code = BigInt(t.code);
        return {
            name:     raw.name,
            data:     { type: 'ir', protocol: t.protocol, code },
            sourceId: '0x' + code.toString(16),
        };
    }
    return {
        name: raw.name,
        data: { type: 'rest', method: t.method, url: t.url, body: t.body },
    };
}

function parseDevice(raw: RawDevice): CatalogDevice {
    return {
        sourceId:     raw.id,
        name:         raw.name,
        manufacturer: raw.manufacturer,
        type:         raw.type,
        functions:    raw.functions.map(parseFunction),
    };
}

const parsedCatalog: CatalogDevice[] = (rawCatalog as RawDevice[]).map(parseDevice);

export class HardcodedCatalogSource implements CatalogSource {
    async search(query: string): Promise<CatalogDevice[]> {
        const q = query.trim().toLowerCase();
        if (!q) return parsedCatalog;
        return parsedCatalog.filter(d =>
            d.name.toLowerCase().includes(q) ||
            d.manufacturer.toLowerCase().includes(q) ||
            d.type.toLowerCase().includes(q)
        );
    }
}
