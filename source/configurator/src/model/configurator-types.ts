import type { Device, DeviceFunction } from '@model/devices.ts';

// Represents a user's selection in the action picker before it is converted
// into a binary Action. Using number for targetStateId avoids a circular
// import (state.ts → actions.ts → configurator-types.ts → state.ts).
export type ActionPickerSelection =
    | { kind: 'device';          device: Device; deviceFunction: DeviceFunction }
    | { kind: 'navigate';        targetStateId: number }
    | { kind: 'pause';           durationMs: number }
    | { kind: 'power_off_active' };

export interface SequenceEditorConfirmation {
    steps:   ActionPickerSelection[];
    name:    string | undefined;
    delayMs: number;
}

// Payload sent from SequenceActionEditor to ButtonActionPanel when the user
// clicks "Back to single action". The coordinator uses it to restore the
// correct selectedKey and (for anonymous sequences) to update the assignment.
export type BackToSingleContext =
    | { kind: 'named';     namedSequenceId: number }
    | { kind: 'anonymous'; firstStep:       ActionPickerSelection | null };
