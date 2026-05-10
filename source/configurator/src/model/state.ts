import type { SequenceId, Sequence, ScreenButtonConfig, PhysicalButtonConfig, IRCode, SequenceAnnotation } from '@model/actions.ts';
import type { Device } from '@model/devices.ts';

export type StateId   = number;
export type StateType = 'root' | 'persistent' | 'ephemeral';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue     = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject { [key: string]: JsonValue; }
export interface JsonArray extends Array<JsonValue> {}

export interface State {
    id: StateId;
    name: string;
    stateType: StateType;
    screenButtons: ScreenButtonConfig[];    // ordered; determines display order
    physicalButtons: PhysicalButtonConfig[];
    onActivate: SequenceId | null;          // Persistent only; null = not configured
    onDeactivate: SequenceId | null;        // Persistent only; null = not configured
    buttonFallback: boolean;                // Ephemeral only
}

export interface ConfiguratorMetadata {
    devices: Device[];
    sequenceAnnotations: SequenceAnnotation[];
    extra: JsonObject;  // unknown top-level keys preserved on round-trip
}

export interface RemoteConfig {
    rootStateId: StateId;
    states: State[];
    sequences: Sequence[];                  // global pool; shared across all states
    irCodes: IRCode[];                      // operational pool; firmware reads this
    metadata: ConfiguratorMetadata;         // configurator-only; stored as compressed JSON blob
}
