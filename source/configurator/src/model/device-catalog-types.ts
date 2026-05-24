import type { DeviceType, FunctionData } from './configurator-types.ts';

export interface CatalogDeviceFunction {
    name:      string;
    data:      FunctionData;
    sourceId?: string;
}

export interface CatalogDevice {
    uuid:         string;
    sourceId:     string;
    name:         string;
    manufacturer: string;
    type:         DeviceType;
    functions:    CatalogDeviceFunction[];
}

export interface DeviceProvider {
    isEnabled: boolean;
    search(query: string): Promise<CatalogDevice[]>;
}
