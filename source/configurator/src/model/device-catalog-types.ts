import type { DeviceType, FunctionData } from './configurator-types.ts';

export interface DeviceTemplateFunction {
    name:      string;
    data:      FunctionData;
    sourceId?: string;
}

export interface DeviceTemplate {
    identifier:              string;
    name:                    string;
    manufacturer:            string;
    type:                    DeviceType;
    providerName:            string;
    allowsMultipleInstances: boolean;
    functions:               DeviceTemplateFunction[];
}

export interface DeviceProvider {
    name:      string;
    isEnabled: boolean;
    search(query: string): Promise<DeviceTemplate[]>;
}
