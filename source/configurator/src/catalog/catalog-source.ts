import type { Device, DeviceFunction, DeviceType } from '@model/devices.ts';
import type { ActionTemplate, IRProtocol } from '@model/actions.ts';
import rawCatalog from './devices.json';

export interface CatalogSource {
    search(query: string): Promise<Device[]>;
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

function parseTemplate(raw: RawTemplate): ActionTemplate {
    if (raw.type === 'ir_send') {
        return { type: 'ir_send', protocol: raw.protocol, code: BigInt(raw.code) };
    }
    return raw;
}

function parseDevice(raw: RawDevice): Device {
    return {
        id:           raw.id,
        name:         raw.name,
        manufacturer: raw.manufacturer,
        type:         raw.type,
        functions:    raw.functions.map((f): DeviceFunction => ({
            name:     f.name,
            template: parseTemplate(f.template),
        })),
    };
}

const parsedCatalog: Device[] = (rawCatalog as RawDevice[]).map(parseDevice);

export class HardcodedCatalogSource implements CatalogSource {
    async search(query: string): Promise<Device[]> {
        const q = query.trim().toLowerCase();
        if (!q) return parsedCatalog;
        return parsedCatalog.filter(d =>
            d.name.toLowerCase().includes(q) ||
            d.manufacturer.toLowerCase().includes(q) ||
            d.type.toLowerCase().includes(q)
        );
    }
}
