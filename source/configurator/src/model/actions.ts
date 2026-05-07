import type { ButtonCode } from '@model/button-codes.ts';

export type SequenceId     = number;
export type ScreenButtonId = number;

export type ActionType =
    | 'navigate'    // params[0..1]: target StateId (uint16, little-endian)
    | 'ir_send'     // params[0..3]: IR code (uint32, little-endian)
    | 'pause'       // params[0..1]: duration in ms (uint16, little-endian)
    | 'rest_call';  // params[0]: request pool ID (uint8)

export interface Action {
    type: ActionType;
    params: [number, number, number, number];  // 4 bytes; unused bytes are 0x00
}

export interface Sequence {
    id: SequenceId;
    name?: string;      // configurator only; not written to firmware-readable sections
    actions: Action[];  // at least one entry
}

export interface PhysicalButtonConfig {
    buttonCode: ButtonCode;
    sequenceId: SequenceId;
}

export interface ScreenButtonConfig {
    id: ScreenButtonId;   // stable UI tracking ID; positional in binary format
    label: string;
    icon?: string;        // icon identifier; format TBD
    sequenceId: SequenceId;
}
