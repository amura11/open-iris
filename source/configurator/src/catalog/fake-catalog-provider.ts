import type { DeviceType, IRProtocol } from '@model/configurator-types.ts';
import type { DeviceTemplate, DeviceTemplateFunction, DeviceProvider } from '@model/device-catalog-types.ts';

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
    name:     string;
    template: RawTemplate;
}

interface RawDevice {
    uuid:         string;
    id:           string;
    name:         string;
    manufacturer: string;
    type:         DeviceType;
    functions:    RawDeviceFunction[];
}

function parseDeviceFunction(rawFunction: RawDeviceFunction): DeviceTemplateFunction {
    const template = rawFunction.template;

    if (template.type === 'ir_send') {
        const code = BigInt(template.code);
        return {
            name:     rawFunction.name,
            data:     { type: 'ir', protocol: template.protocol, code },
            sourceId: '0x' + code.toString(16),
        };
    }

    return {
        name: rawFunction.name,
        data: { type: 'rest', method: template.method, url: template.url, body: template.body },
    };
}

function parseDevice(rawDevice: RawDevice, providerName: string): DeviceTemplate {
    return {
        identifier:              rawDevice.uuid,
        name:                    rawDevice.name,
        manufacturer:            rawDevice.manufacturer,
        type:                    rawDevice.type,
        providerName,
        allowsMultipleInstances: rawDevice.type !== 'ir',
        functions:               rawDevice.functions.map(parseDeviceFunction),
    };
}

export class FakeCatalogProvider implements DeviceProvider {
    name      = 'OpenIRis Catalog';
    isEnabled = true;

    async search(query: string): Promise<DeviceTemplate[]> {
        const { default: rawDevices } = await import('./devices.json');
        const parsedDevices = (rawDevices as RawDevice[]).map(rawDevice => parseDevice(rawDevice, this.name));
        const normalizedQuery = query.trim().toLowerCase();

        if (!normalizedQuery) {
            return parsedDevices;
        }

        return parsedDevices.filter(device =>
            device.name.toLowerCase().includes(normalizedQuery) ||
            device.manufacturer.toLowerCase().includes(normalizedQuery) ||
            device.type.toLowerCase().includes(normalizedQuery)
        );
    }
}
