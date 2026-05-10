import type { ActionTemplate } from '@model/actions.ts';

export type DeviceId   = string;
export type DeviceType = 'ir' | 'rest'; // 'matter' reserved for future

export interface DeviceFunction {
    name: string;
    template: ActionTemplate;
}

export interface Device {
    id: DeviceId;
    name: string;
    manufacturer: string;
    type: DeviceType;
    functions: DeviceFunction[];
}
