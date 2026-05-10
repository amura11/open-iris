import type { IRProtocol } from '@model/actions.ts';
import type { StateType } from '@model/state.ts';
import { ButtonCode } from '@model/button-codes.ts';

// ── Format identity ───────────────────────────────────────────────────────────

export const MAGIC   = [0x49, 0x52, 0x49, 0x53] as const; // "IRIS"
export const VERSION = 0x04;

// ── Section type tags ─────────────────────────────────────────────────────────

export const TYPE_STATES   = 0x01;
export const TYPE_SEQS     = 0x02;
export const TYPE_IR_CODES = 0x03;
export const TYPE_METADATA = 0xFF;

// ── Layout sizes ──────────────────────────────────────────────────────────────

export const HEADER_SIZE         = 7;  // magic(4) + version(1) + root_state_id(2)
export const MANIFEST_ENTRY_SIZE = 11; // type_tag(1) + count(2) + index_offset(4) + data_offset(4)
export const INDEX_ENTRY_SIZE    = 8;  // id(2) + data_offset(4) + data_length(2)

// ── Sentinel values ───────────────────────────────────────────────────────────

export const SEQUENCE_ID_NONE  = 0xFFFF;
export const ICON_ID_NONE      = 0xFFFF;
export const METADATA_VERSION  = 1;

// ── IR protocol ───────────────────────────────────────────────────────────────

export const IR_PROTOCOL_BYTE: Record<IRProtocol, number> = {
    nec:     0x01,
    sony:    0x02,
    rc5:     0x03,
    samsung: 0x04,
    raw:     0x05,
};

export const BYTE_TO_IR_PROTOCOL: Record<number, IRProtocol> = {
    0x01: 'nec',
    0x02: 'sony',
    0x03: 'rc5',
    0x04: 'samsung',
    0x05: 'raw',
};

// ── State type ────────────────────────────────────────────────────────────────

export const STATE_TYPE_BYTE: Record<StateType, number> = {
    root:       0x00,
    persistent: 0x01,
    ephemeral:  0x02,
};

export const BYTE_TO_STATE_TYPE: Record<number, StateType> = {
    0x00: 'root',
    0x01: 'persistent',
    0x02: 'ephemeral',
};

// ── Button code ───────────────────────────────────────────────────────────────

export const BUTTON_CODE_BYTE: Record<ButtonCode, number> = {
    [ButtonCode.POWER]:       0x00,
    [ButtonCode.SOURCE]:      0x01,
    [ButtonCode.DPAD_UP]:     0x02,
    [ButtonCode.DPAD_DOWN]:   0x03,
    [ButtonCode.DPAD_LEFT]:   0x04,
    [ButtonCode.DPAD_RIGHT]:  0x05,
    [ButtonCode.DPAD_CENTER]: 0x06,
    [ButtonCode.BACK]:        0x07,
    [ButtonCode.HOME]:        0x08,
    [ButtonCode.PLAY_PAUSE]:  0x09,
    [ButtonCode.MUTE]:        0x0A,
    [ButtonCode.VOL_UP]:      0x0B,
    [ButtonCode.VOL_DOWN]:    0x0C,
    [ButtonCode.PAGE_UP]:     0x0D,
    [ButtonCode.PAGE_DOWN]:   0x0E,
    [ButtonCode.PROG_1]:      0x0F,
    [ButtonCode.PROG_2]:      0x10,
    [ButtonCode.PROG_3]:      0x11,
    [ButtonCode.PROG_4]:      0x12,
    [ButtonCode.PROG_5]:      0x13,
    [ButtonCode.PROG_6]:      0x14,
};

export const BYTE_TO_BUTTON_CODE: Record<number, ButtonCode> = {
    0x00: ButtonCode.POWER,
    0x01: ButtonCode.SOURCE,
    0x02: ButtonCode.DPAD_UP,
    0x03: ButtonCode.DPAD_DOWN,
    0x04: ButtonCode.DPAD_LEFT,
    0x05: ButtonCode.DPAD_RIGHT,
    0x06: ButtonCode.DPAD_CENTER,
    0x07: ButtonCode.BACK,
    0x08: ButtonCode.HOME,
    0x09: ButtonCode.PLAY_PAUSE,
    0x0A: ButtonCode.MUTE,
    0x0B: ButtonCode.VOL_UP,
    0x0C: ButtonCode.VOL_DOWN,
    0x0D: ButtonCode.PAGE_UP,
    0x0E: ButtonCode.PAGE_DOWN,
    0x0F: ButtonCode.PROG_1,
    0x10: ButtonCode.PROG_2,
    0x11: ButtonCode.PROG_3,
    0x12: ButtonCode.PROG_4,
    0x13: ButtonCode.PROG_5,
    0x14: ButtonCode.PROG_6,
};
