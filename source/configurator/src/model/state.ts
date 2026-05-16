import type { SequenceId, Sequence, ScreenButtonConfig, PhysicalButtonConfig, DataBlock } from '@model/actions.ts';
import type { Device, DeviceFunction, DeviceId, FunctionId } from '@model/devices.ts';

export type StateId   = number;
export type StateType = 'root' | 'persistent' | 'ephemeral';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue     = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject { [key: string]: JsonValue; }
export interface JsonArray extends Array<JsonValue> {}

export interface State {
    id:              StateId;
    name:            string;
    stateType:       StateType;
    screenButtons:   ScreenButtonConfig[];
    physicalButtons: PhysicalButtonConfig[];
    onActivate:      SequenceId | null;
    onDeactivate:    SequenceId | null;
    buttonFallback:  boolean;
    activeDevices:   DeviceId[];
}

// ── Metadata (configurator-only, stored as compressed JSON) ───────────────────

export interface SequenceMetadata {
    sequenceId: SequenceId;
    name?:      string;
}

export interface DeviceMetadata {
    id:           DeviceId;
    manufacturer: string;
    description?: string;
    sourceId?:    string;   // catalog origin; used for update reconciliation
}

export interface FunctionMetadata {
    id:        FunctionId;
    sourceId?: string;      // e.g. IR code hex, or hash of REST params
}

export interface IdCounters {
    device:    number;
    function:  number;
    sequence:  number;
    state:     number;
    dataBlock: number;
}

export interface RemoteMetadata {
    idCounters:       IdCounters;
    deviceMetadata:   DeviceMetadata[];
    functionMetadata: FunctionMetadata[];
    sequenceMetadata: SequenceMetadata[];
    extra:            JsonObject;   // unknown top-level keys preserved on round-trip
}

// ── Remote config ─────────────────────────────────────────────────────────────

export interface RemoteConfig {
    rootStateId: StateId;
    states:      State[];
    sequences:   Sequence[];
    devices:     Device[];
    functions:   DeviceFunction[];
    dataBlocks:  DataBlock[];
    metadata:    RemoteMetadata;
}
