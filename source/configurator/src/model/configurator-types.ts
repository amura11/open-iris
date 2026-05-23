import type { ButtonCode } from '@model/button-codes.ts';

// ── Shared primitive types ────────────────────────────────────────────────────
// Stable IDs and value enums shared by both the UI layer and the wire format.

export type StateId        = number;
export type SequenceId     = number;
export type ScreenButtonId = number;
export type DataBlockId    = number;
export type DeviceId       = number;
export type FunctionId     = number;

export type StateType       = 'root' | 'persistent' | 'ephemeral';
export type DeviceType      = 'ir' | 'rest' | 'matter';
export type DevicePowerMode = 'none' | 'toggle' | 'discrete';
export type IRProtocol      = 'nec' | 'sony' | 'rc5' | 'samsung' | 'raw';

export type FunctionData =
    | { type: 'ir';   protocol: IRProtocol; code: bigint }
    | { type: 'rest'; method: string; url: string; body?: string };

// ── UI-layer domain types ─────────────────────────────────────────────────────

export type SequenceStep =
    | { kind: 'device';          device: Device; deviceFunction: DeviceFunction }
    | { kind: 'navigate';        targetStateId: number }
    | { kind: 'pause';           durationMs: number }
    | { kind: 'power_off_active' };

export interface DeviceFunction {
    id:        FunctionId;
    deviceId:  DeviceId;
    name:      string;
    data:      FunctionData;
    sourceId?: string;
}

export interface Device {
    id:                  DeviceId;
    name:                string;
    type:                DeviceType;
    powerMode:           DevicePowerMode;
    powerOnFunctionId?:  FunctionId;
    powerOffFunctionId?: FunctionId;
    manufacturer:        string;
    sourceId?:           string;
    functions:           DeviceFunction[];
}

export interface Sequence {
    id:      SequenceId;
    name?:   string;
    delayMs: number;
    steps:   SequenceStep[];
}

export type ButtonAssignment =
    | { kind: 'sequence'; sequenceId: SequenceId }
    | { kind: 'action';   deviceId: DeviceId; functionId: FunctionId; data: number };

export interface PhysicalButton {
    buttonCode: ButtonCode;
    assignment: ButtonAssignment;
}

export interface ScreenButton {
    id:         ScreenButtonId;
    label:      string;
    icon?:      string;
    assignment: ButtonAssignment | null;
}

export interface State {
    id:              StateId;
    name:            string;
    stateType:       StateType;
    screenButtons:   ScreenButton[];
    physicalButtons: PhysicalButton[];
    onActivate:      SequenceId | null;
    onDeactivate:    SequenceId | null;
    buttonFallback:  boolean;
    activeDevices:   DeviceId[];
}

// ── Action picker ─────────────────────────────────────────────────────────────

export type ActionPickerSelection = SequenceStep;

// ── Dialog / editor types ─────────────────────────────────────────────────────

export interface SequenceEditorConfirmation {
    steps:   SequenceStep[];
    name:    string | undefined;
    delayMs: number;
}

export type BackToSingleContext =
    | { kind: 'named';     namedSequenceId: number }
    | { kind: 'anonymous'; firstStep:       SequenceStep | null };
