import type { Device, DeviceFunction } from '@model/devices.ts';

// Represents a user's selection in the action picker before it is materialized
// into a binary Action + IRCode. Using number for targetStateId avoids a
// circular import (state.ts → actions.ts → configurator-types.ts → state.ts).
export type ActionPickerSelection =
    | { kind: 'device'; device: Device; deviceFunction: DeviceFunction }
    | { kind: 'navigate'; targetStateId: number }
    | { kind: 'pause'; durationMs: number };

export interface SequenceEditorConfirmation {
    steps: ActionPickerSelection[];
    name: string | undefined;
}
