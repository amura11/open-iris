import type { ButtonCode } from '@model/button-codes.ts';
import type { DeviceId, FunctionId } from '@model/devices.ts';

export type SequenceId     = number;
export type ScreenButtonId = number;
export type DataBlockId    = number;

// ── IR protocol ───────────────────────────────────────────────────────────────

export type IRProtocol = 'nec' | 'sony' | 'rc5' | 'samsung' | 'raw';

// ── Function data (type-specific payload) ─────────────────────────────────────

export type FunctionData =
    | { type: 'ir';   protocol: IRProtocol; code: bigint }
    | { type: 'rest'; method: string; url: string; body?: string };

// ── Data block ────────────────────────────────────────────────────────────────

export interface DataBlock {
    id:   DataBlockId;
    data: Uint8Array;
}

// ── Action (6 bytes: deviceId + functionId + data) ────────────────────────────

export interface Action {
    deviceId:   DeviceId;
    functionId: FunctionId;
    data:       number;   // uint16; inline value or DataBlockId; 0xFFFF if unused
}

// ── Sequence ──────────────────────────────────────────────────────────────────

export interface Sequence {
    id:      SequenceId;
    actions: Action[];
}

// ── Button assignments ────────────────────────────────────────────────────────

export interface PhysicalButtonConfig {
    buttonCode: ButtonCode;
    assignment:
        | { kind: 'sequence'; sequenceId: SequenceId }
        | { kind: 'action';   deviceId: DeviceId; functionId: FunctionId; data: number };
}

export interface ScreenButtonConfig {
    id:    ScreenButtonId;
    label: string;
    icon?: string;
    assignment:
        | { kind: 'sequence'; sequenceId: SequenceId }
        | { kind: 'action';   deviceId: DeviceId; functionId: FunctionId; data: number }
        | null;
}
