import type { ButtonCode } from '@model/button-codes.ts';
import type { DeviceId } from '@model/devices.ts';

export type SequenceId     = number;
export type ScreenButtonId = number;

export type ActionType =
    | 'navigate'    // params[0..1]: target StateId (uint16, little-endian)
    | 'ir_send'     // params[0..1]: IRCodeId (uint16, little-endian); params[2..3]: unused
    | 'pause'       // params[0..1]: duration in ms (uint16, little-endian)
    | 'rest_call';  // params[0..1]: resource pool ID (uint16, little-endian) — deferred

// Wire byte values for ActionType — must stay in sync with firmware action_dispatch.h
export const ACTION_TYPE_BYTE: Record<ActionType, number> = {
    navigate:  0x01,
    ir_send:   0x02,
    pause:     0x03,
    rest_call: 0x04,
};

export const BYTE_TO_ACTION_TYPE: Record<number, ActionType> = Object.fromEntries(
    Object.entries(ACTION_TYPE_BYTE).map(([k, v]) => [v, k as ActionType])
);

export interface Action {
    type: ActionType;
    params: [number, number, number, number];  // 4 bytes; unused bytes are 0x00
}

export interface Sequence {
    id: SequenceId;
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

// ── IR code resource (operational — firmware reads this) ──────────────────────

export type IRProtocol = 'nec' | 'sony' | 'rc5' | 'samsung' | 'raw';

export type IRCodeId = number; // uint16

export interface IRCode {
    id: IRCodeId;
    protocol: IRProtocol;
    code: bigint; // uint64 — matches IRremoteESP8266's uint64_t representation
}

// ── Configurator-only types ───────────────────────────────────────────────────

export interface TemplateParameter {
    name: string;
    label: string;
    defaultValue?: string;
}

export type ActionTemplate =
    | { type: 'ir_send'; protocol: IRProtocol; code: bigint }
    | { type: 'rest_call'; method: string; url: string; body?: string; parameters?: TemplateParameter[] }; // deferred

export interface SequenceAnnotation {
    sequenceId: SequenceId;
    name: string;
    source?: {
        deviceId: DeviceId;
        functionName: string;
    };
}
