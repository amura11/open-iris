import { describe, it, expect } from 'vitest';
import {
    BUTTON_CODE_BYTE, BYTE_TO_BUTTON_CODE,
    IR_PROTOCOL_BYTE, BYTE_TO_IR_PROTOCOL,
    STATE_TYPE_BYTE, BYTE_TO_STATE_TYPE,
    DEVICE_TYPE_BYTE, BYTE_TO_DEVICE_TYPE,
    POWER_MODE_BYTE, BYTE_TO_POWER_MODE,
} from './serialization.ts';
import type { IRProtocol, StateType, DeviceType, DevicePowerMode } from '@model/configurator-types.ts';
import { ButtonCode } from '@model/button-codes.ts';

describe('BUTTON_CODE_BYTE / BYTE_TO_BUTTON_CODE', () => {
    it('covers all ButtonCode enum values', () => {
        const encodedCodes = new Set(Object.keys(BUTTON_CODE_BYTE));

        for (const code of Object.values(ButtonCode)) {
            expect(encodedCodes.has(code)).toBe(true);
        }
    });

    it('is a bijection: every code encodes to a unique byte', () => {
        const bytes = Object.values(BUTTON_CODE_BYTE);
        const uniqueBytes = new Set(bytes);

        expect(uniqueBytes.size).toBe(bytes.length);
    });

    it('round-trips: encode then decode returns the original code', () => {
        for (const code of Object.values(ButtonCode)) {
            const byte = BUTTON_CODE_BYTE[code];
            expect(BYTE_TO_BUTTON_CODE[byte]).toBe(code);
        }
    });

    it('round-trips: decode then encode returns the original byte', () => {
        for (const [byteString, code] of Object.entries(BYTE_TO_BUTTON_CODE)) {
            expect(BUTTON_CODE_BYTE[code]).toBe(Number(byteString));
        }
    });
});

describe('IR_PROTOCOL_BYTE / BYTE_TO_IR_PROTOCOL', () => {
    const allProtocols: IRProtocol[] = ['nec', 'sony', 'rc5', 'samsung', 'raw'];

    it('covers all IRProtocol values', () => {
        for (const protocol of allProtocols) {
            expect(IR_PROTOCOL_BYTE[protocol]).toBeDefined();
        }
    });

    it('round-trips: encode then decode returns the original protocol', () => {
        for (const protocol of allProtocols) {
            const byte = IR_PROTOCOL_BYTE[protocol];
            expect(BYTE_TO_IR_PROTOCOL[byte]).toBe(protocol);
        }
    });
});

describe('STATE_TYPE_BYTE / BYTE_TO_STATE_TYPE', () => {
    const allStateTypes: StateType[] = ['root', 'persistent', 'ephemeral'];

    it('covers all StateType values', () => {
        for (const stateType of allStateTypes) {
            expect(STATE_TYPE_BYTE[stateType]).toBeDefined();
        }
    });

    it('round-trips: encode then decode returns the original state type', () => {
        for (const stateType of allStateTypes) {
            const byte = STATE_TYPE_BYTE[stateType];
            expect(BYTE_TO_STATE_TYPE[byte]).toBe(stateType);
        }
    });
});

describe('DEVICE_TYPE_BYTE / BYTE_TO_DEVICE_TYPE', () => {
    const allDeviceTypes: DeviceType[] = ['ir', 'rest', 'matter'];

    it('covers all DeviceType values', () => {
        for (const deviceType of allDeviceTypes) {
            expect(DEVICE_TYPE_BYTE[deviceType]).toBeDefined();
        }
    });

    it('round-trips: encode then decode returns the original device type', () => {
        for (const deviceType of allDeviceTypes) {
            const byte = DEVICE_TYPE_BYTE[deviceType];
            expect(BYTE_TO_DEVICE_TYPE[byte]).toBe(deviceType);
        }
    });
});

describe('POWER_MODE_BYTE / BYTE_TO_POWER_MODE', () => {
    const allPowerModes: DevicePowerMode[] = ['none', 'toggle', 'discrete'];

    it('covers all DevicePowerMode values', () => {
        for (const powerMode of allPowerModes) {
            expect(POWER_MODE_BYTE[powerMode]).toBeDefined();
        }
    });

    it('round-trips: encode then decode returns the original power mode', () => {
        for (const powerMode of allPowerModes) {
            const byte = POWER_MODE_BYTE[powerMode];
            expect(BYTE_TO_POWER_MODE[byte]).toBe(powerMode);
        }
    });
});
