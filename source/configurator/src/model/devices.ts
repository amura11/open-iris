import type { FunctionData } from '@model/actions.ts';

export type DeviceId        = number;   // uint16
export type FunctionId      = number;   // uint16
export type DeviceType      = 'ir' | 'rest' | 'matter';
export type DevicePowerMode = 'none' | 'toggle' | 'discrete';

export interface DeviceFunction {
    id:       FunctionId;
    deviceId: DeviceId;
    name:     string;
    data:     FunctionData;
}

export interface Device {
    id:                  DeviceId;
    name:                string;
    type:                DeviceType;
    powerMode:           DevicePowerMode;
    powerOnFunctionId?:  FunctionId;
    powerOffFunctionId?: FunctionId;
}
