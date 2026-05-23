import type {
    FunctionData, StateType, DeviceType, DevicePowerMode,
    StateId, SequenceId, ScreenButtonId, DataBlockId, DeviceId, FunctionId,
} from '@model/configurator-types.ts';
import type { ButtonCode } from '@model/button-codes.ts';

// ── JSON primitives (for the metadata extra field) ────────────────────────────

export type WireJsonPrimitive = string | number | boolean | null;
export type WireJsonValue     = WireJsonPrimitive | WireJsonObject | WireJsonArray;
export interface WireJsonObject { [key: string]: WireJsonValue; }
export interface WireJsonArray  extends Array<WireJsonValue> {}

// ── Wire action ───────────────────────────────────────────────────────────────

export interface WireAction {
    deviceId:   DeviceId;
    functionId: FunctionId;
    data:       number;
}

// ── Wire sequence ─────────────────────────────────────────────────────────────

export interface WireSequence {
    id:      SequenceId;
    actions: WireAction[];
}

// ── Wire button assignments ───────────────────────────────────────────────────

type WireButtonAssignment =
    | { kind: 'sequence'; sequenceId: SequenceId }
    | { kind: 'action';   deviceId: DeviceId; functionId: FunctionId; data: number };

export interface WirePhysicalButton {
    buttonCode: ButtonCode;
    assignment: WireButtonAssignment;
}

export interface WireScreenButton {
    id:         ScreenButtonId;
    label:      string;
    icon?:      string;
    assignment: WireButtonAssignment | null;
}

// ── Wire state ────────────────────────────────────────────────────────────────

export interface WireState {
    id:              StateId;
    name:            string;
    stateType:       StateType;
    screenButtons:   WireScreenButton[];
    physicalButtons: WirePhysicalButton[];
    onActivate:      SequenceId | null;
    onDeactivate:    SequenceId | null;
    buttonFallback:  boolean;
    activeDevices:   DeviceId[];
}

// ── Wire device & function ────────────────────────────────────────────────────

export interface WireDeviceFunction {
    id:       FunctionId;
    deviceId: DeviceId;
    name:     string;
    data:     FunctionData;
}

export interface WireDevice {
    id:                  DeviceId;
    name:                string;
    type:                DeviceType;
    powerMode:           DevicePowerMode;
    powerOnFunctionId?:  FunctionId;
    powerOffFunctionId?: FunctionId;
}

// ── Wire data block ───────────────────────────────────────────────────────────

export interface WireDataBlock {
    id:   DataBlockId;
    data: Uint8Array;
}

// ── Wire metadata ─────────────────────────────────────────────────────────────

export interface WireSequenceMetadata {
    sequenceId: SequenceId;
    name?:      string;
    delayMs?:   number;
}

export interface WireDeviceMetadata {
    id:           DeviceId;
    manufacturer: string;
    description?: string;
    sourceId?:    string;
}

export interface WireFunctionMetadata {
    id:        FunctionId;
    sourceId?: string;
}

export interface WireIdCounters {
    device:    number;
    function:  number;
    sequence:  number;
    state:     number;
    dataBlock: number;
}

export interface WireMetadata {
    idCounters:       WireIdCounters;
    deviceMetadata:   WireDeviceMetadata[];
    functionMetadata: WireFunctionMetadata[];
    sequenceMetadata: WireSequenceMetadata[];
    extra:            WireJsonObject;
}

// ── Top-level wire config ─────────────────────────────────────────────────────

export interface WireConfig {
    rootStateId: StateId;
    states:      WireState[];
    sequences:   WireSequence[];
    devices:     WireDevice[];
    functions:   WireDeviceFunction[];
    dataBlocks:  WireDataBlock[];
    metadata:    WireMetadata;
}
