import { describe, it, expect } from 'vitest';
import { assignmentLabel } from './label-utils.ts';
import type { ButtonAssignment, Device, Sequence, State } from '@model/configurator-types.ts';
import { SYSTEM_DEVICE_ID, SYSTEM_FN_NAVIGATE, SYSTEM_FN_PAUSE, SYSTEM_FN_POWER_OFF_ACTIVE } from '@model/serialization.ts';

const testDevice: Device = {
    id:           10,
    name:         'TV',
    type:         'ir',
    powerMode:    'none',
    manufacturer: 'Sony',
    functions: [
        {
            id:       100,
            deviceId: 10,
            name:     'Power',
            data:     { type: 'ir', protocol: 'nec', code: BigInt(0xA1B2C3D4) },
        },
    ],
};

const testState: State = {
    id:              1,
    name:            'Living Room',
    stateType:       'root',
    screenButtons:   [],
    physicalButtons: [],
    onActivate:      null,
    onDeactivate:    null,
    buttonFallback:  false,
    activeDevices:   [],
};

const devices: Device[] = [testDevice];
const states: State[]   = [testState];

describe('assignmentLabel — action assignments', () => {
    it('returns device and function name for a device action', () => {
        const assignment: ButtonAssignment = { kind: 'action', deviceId: 10, functionId: 100, data: 0 };

        expect(assignmentLabel(assignment, devices, [], states)).toBe('TV → Power');
    });

    it('returns Unknown for an action pointing to a missing device', () => {
        const assignment: ButtonAssignment = { kind: 'action', deviceId: 999, functionId: 100, data: 0 };

        expect(assignmentLabel(assignment, devices, [], states)).toBe('Unknown → Unknown');
    });

    it('returns Navigate label with state name', () => {
        const assignment: ButtonAssignment = { kind: 'action', deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_NAVIGATE, data: 1 };

        expect(assignmentLabel(assignment, devices, [], states)).toBe('Navigate → Living Room');
    });

    it('returns Navigate with Unknown for a missing state', () => {
        const assignment: ButtonAssignment = { kind: 'action', deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_NAVIGATE, data: 999 };

        expect(assignmentLabel(assignment, devices, [], states)).toBe('Navigate → Unknown');
    });

    it('returns Pause label with duration', () => {
        const assignment: ButtonAssignment = { kind: 'action', deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_PAUSE, data: 500 };

        expect(assignmentLabel(assignment, devices, [], states)).toBe('Pause 500ms');
    });

    it('returns power off label', () => {
        const assignment: ButtonAssignment = { kind: 'action', deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_POWER_OFF_ACTIVE, data: 0 };

        expect(assignmentLabel(assignment, devices, [], states)).toBe('Power off active devices');
    });
});

describe('assignmentLabel — sequence assignments', () => {
    it('returns the sequence name for a named sequence', () => {
        const sequences: Sequence[] = [{ id: 1, name: 'Watch TV', delayMs: 200, steps: [] }];
        const assignment: ButtonAssignment = { kind: 'sequence', sequenceId: 1 };

        expect(assignmentLabel(assignment, devices, sequences, states)).toBe('Watch TV');
    });

    it('returns the step label for a single-step anonymous device sequence', () => {
        const sequences: Sequence[] = [{
            id:      2,
            delayMs: 200,
            steps:   [{ kind: 'device', device: testDevice, deviceFunction: testDevice.functions[0] }],
        }];
        const assignment: ButtonAssignment = { kind: 'sequence', sequenceId: 2 };

        expect(assignmentLabel(assignment, devices, sequences, states)).toBe('TV → Power');
    });

    it('returns the navigate step label for a single-step anonymous navigate sequence', () => {
        const sequences: Sequence[] = [{
            id:      3,
            delayMs: 200,
            steps:   [{ kind: 'navigate', targetStateId: 1 }],
        }];
        const assignment: ButtonAssignment = { kind: 'sequence', sequenceId: 3 };

        expect(assignmentLabel(assignment, devices, sequences, states)).toBe('Navigate → Living Room');
    });

    it('returns the pause step label for a single-step anonymous pause sequence', () => {
        const sequences: Sequence[] = [{
            id:      4,
            delayMs: 200,
            steps:   [{ kind: 'pause', durationMs: 250 }],
        }];
        const assignment: ButtonAssignment = { kind: 'sequence', sequenceId: 4 };

        expect(assignmentLabel(assignment, devices, sequences, states)).toBe('Pause 250ms');
    });

    it('returns the power off step label for a single-step power_off_active sequence', () => {
        const sequences: Sequence[] = [{
            id:      5,
            delayMs: 200,
            steps:   [{ kind: 'power_off_active' }],
        }];
        const assignment: ButtonAssignment = { kind: 'sequence', sequenceId: 5 };

        expect(assignmentLabel(assignment, devices, sequences, states)).toBe('Power off active devices');
    });

    it('returns step count for a multi-step anonymous sequence', () => {
        const sequences: Sequence[] = [{
            id:      6,
            delayMs: 200,
            steps: [
                { kind: 'device', device: testDevice, deviceFunction: testDevice.functions[0] },
                { kind: 'navigate', targetStateId: 1 },
                { kind: 'pause', durationMs: 100 },
            ],
        }];
        const assignment: ButtonAssignment = { kind: 'sequence', sequenceId: 6 };

        expect(assignmentLabel(assignment, devices, sequences, states)).toBe('3 actions');
    });

    it('returns Unknown sequence for a missing sequence ID', () => {
        const assignment: ButtonAssignment = { kind: 'sequence', sequenceId: 999 };

        expect(assignmentLabel(assignment, devices, [], states)).toBe('Unknown sequence');
    });
});
