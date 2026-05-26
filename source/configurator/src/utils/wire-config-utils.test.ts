import { describe, it, expect } from 'vitest';
import {
    wireActionToStep,
    stepToWireAction,
    stepToAssignment,
    withPhysicalButton,
    buildWireConfig,
    parseWireConfig,
} from './wire-config-utils.ts';
import type { Device, Sequence, SequenceStep, State, PhysicalButton } from '@model/configurator-types.ts';
import type { WireConfig, WireIdCounters } from '@model/wire-types.ts';
import { ButtonCode } from '@model/button-codes.ts';
import {
    SYSTEM_DEVICE_ID, SYSTEM_FN_NAVIGATE, SYSTEM_FN_PAUSE, SYSTEM_FN_POWER_OFF_ACTIVE, IRIS_NO_ID,
} from '@model/serialization.ts';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TV_FUNCTION = {
    id: 10, deviceId: 1, name: 'Power', data: { type: 'ir' as const, protocol: 'nec' as const, code: 0n },
};

const TV_DEVICE: Device = {
    id: 1, name: 'TV', type: 'ir', powerMode: 'none', manufacturer: 'Sony', sourceId: 'sony-tv',
    functions: [TV_FUNCTION],
};

const ROOT_STATE: State = {
    id:              0,
    name:            'Home',
    stateType:       'root',
    screenButtons:   [],
    physicalButtons: [],
    onActivate:      null,
    onDeactivate:    null,
    buttonFallback:  false,
    activeDevices:   [],
};

const DEFAULT_COUNTERS: WireIdCounters = { device: 1, function: 1, sequence: 0, state: 1, dataBlock: 0 };

// ── wireActionToStep ──────────────────────────────────────────────────────────

describe('wireActionToStep', () => {
    it('converts a navigate action to a navigate step', () => {
        const steps = wireActionToStep({ deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_NAVIGATE, data: 5 }, []);

        expect(steps).toEqual([{ kind: 'navigate', targetStateId: 5 }]);
    });

    it('converts a pause action to a pause step', () => {
        const steps = wireActionToStep({ deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_PAUSE, data: 300 }, []);

        expect(steps).toEqual([{ kind: 'pause', durationMs: 300 }]);
    });

    it('converts any other system action to a power_off_active step', () => {
        const steps = wireActionToStep({ deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_POWER_OFF_ACTIVE, data: IRIS_NO_ID }, []);

        expect(steps).toEqual([{ kind: 'power_off_active' }]);
    });

    it('resolves a device action to a device step', () => {
        const steps = wireActionToStep({ deviceId: 1, functionId: 10, data: IRIS_NO_ID }, [TV_DEVICE]);

        expect(steps).toHaveLength(1);
        expect(steps[0]).toMatchObject({ kind: 'device', device: TV_DEVICE, deviceFunction: TV_FUNCTION });
    });

    it('returns an empty array when the device is not found', () => {
        const steps = wireActionToStep({ deviceId: 99, functionId: 10, data: IRIS_NO_ID }, [TV_DEVICE]);

        expect(steps).toEqual([]);
    });

    it('returns an empty array when the function is not found on the device', () => {
        const steps = wireActionToStep({ deviceId: 1, functionId: 99, data: IRIS_NO_ID }, [TV_DEVICE]);

        expect(steps).toEqual([]);
    });
});

// ── stepToWireAction ──────────────────────────────────────────────────────────

describe('stepToWireAction', () => {
    it('converts a device step', () => {
        const action = stepToWireAction({ kind: 'device', device: TV_DEVICE, deviceFunction: TV_FUNCTION });

        expect(action).toEqual({ deviceId: 1, functionId: 10, data: IRIS_NO_ID });
    });

    it('converts a navigate step', () => {
        const action = stepToWireAction({ kind: 'navigate', targetStateId: 5 });

        expect(action).toEqual({ deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_NAVIGATE, data: 5 });
    });

    it('converts a pause step', () => {
        const action = stepToWireAction({ kind: 'pause', durationMs: 300 });

        expect(action).toEqual({ deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_PAUSE, data: 300 });
    });

    it('converts a power_off_active step', () => {
        const action = stepToWireAction({ kind: 'power_off_active' });

        expect(action).toEqual({ deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_POWER_OFF_ACTIVE, data: IRIS_NO_ID });
    });
});

// ── stepToAssignment ──────────────────────────────────────────────────────────

describe('stepToAssignment', () => {
    it('converts a device step to an action assignment', () => {
        const assignment = stepToAssignment({ kind: 'device', device: TV_DEVICE, deviceFunction: TV_FUNCTION });

        expect(assignment).toEqual({ kind: 'action', deviceId: 1, functionId: 10, data: IRIS_NO_ID });
    });

    it('converts a navigate step to an action assignment with system IDs', () => {
        const assignment = stepToAssignment({ kind: 'navigate', targetStateId: 3 });

        expect(assignment).toEqual({ kind: 'action', deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_NAVIGATE, data: 3 });
    });

    it('converts a power_off_active step to an action assignment', () => {
        const assignment = stepToAssignment({ kind: 'power_off_active' });

        expect(assignment).toEqual({ kind: 'action', deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_POWER_OFF_ACTIVE, data: IRIS_NO_ID });
    });
});

// ── withPhysicalButton ────────────────────────────────────────────────────────

describe('withPhysicalButton', () => {
    const assignment = { kind: 'action' as const, deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_NAVIGATE, data: 0 };

    it('appends a new entry when the button code is not already present', () => {
        const result = withPhysicalButton([], ButtonCode.VOL_UP, assignment);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ buttonCode: ButtonCode.VOL_UP, assignment });
    });

    it('replaces the entry when the button code already exists', () => {
        const existing: PhysicalButton[] = [{ buttonCode: ButtonCode.VOL_UP, assignment }];
        const newAssignment = { kind: 'action' as const, deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_PAUSE, data: 200 };

        const result = withPhysicalButton(existing, ButtonCode.VOL_UP, newAssignment);

        expect(result).toHaveLength(1);
        expect(result[0].assignment).toEqual(newAssignment);
    });

    it('leaves other buttons untouched when updating one', () => {
        const other: PhysicalButton = { buttonCode: ButtonCode.MUTE, assignment };
        const result = withPhysicalButton([other], ButtonCode.VOL_UP, assignment);

        expect(result).toHaveLength(2);
        expect(result.find(b => b.buttonCode === ButtonCode.MUTE)).toBeDefined();
    });

    it('does not mutate the original array', () => {
        const original: PhysicalButton[] = [];
        withPhysicalButton(original, ButtonCode.VOL_UP, assignment);

        expect(original).toHaveLength(0);
    });
});

// ── buildWireConfig / parseWireConfig round-trip ──────────────────────────────

describe('buildWireConfig / parseWireConfig round-trip', () => {
    it('round-trips an empty config', () => {
        const wire = buildWireConfig([], [], [ROOT_STATE], 0, DEFAULT_COUNTERS);
        const parsed = parseWireConfig(wire);

        expect(parsed.devices).toEqual([]);
        expect(parsed.sequences).toEqual([]);
        expect(parsed.states).toHaveLength(1);
        expect(parsed.states[0].name).toBe('Home');
        expect(parsed.rootStateId).toBe(0);
        expect(parsed.idCounters).toEqual(DEFAULT_COUNTERS);
    });

    it('round-trips a device with its functions', () => {
        const wire = buildWireConfig([TV_DEVICE], [], [ROOT_STATE], 0, DEFAULT_COUNTERS);
        const parsed = parseWireConfig(wire);

        expect(parsed.devices).toHaveLength(1);
        expect(parsed.devices[0].name).toBe('TV');
        expect(parsed.devices[0].manufacturer).toBe('Sony');
        expect(parsed.devices[0].sourceId).toBe('sony-tv');
        expect(parsed.devices[0].functions).toHaveLength(1);
        expect(parsed.devices[0].functions[0].name).toBe('Power');
    });

    it('round-trips a sequence with steps', () => {
        const steps: SequenceStep[] = [
            { kind: 'navigate', targetStateId: 0 },
            { kind: 'pause', durationMs: 150 },
        ];
        const sequences: Sequence[] = [{ id: 0, steps, delayMs: 200 }];
        const wire = buildWireConfig([], sequences, [ROOT_STATE], 0, DEFAULT_COUNTERS);
        const parsed = parseWireConfig(wire);

        expect(parsed.sequences).toHaveLength(1);
        expect(parsed.sequences[0].steps).toEqual(steps);
        expect(parsed.sequences[0].delayMs).toBe(200);
    });

    it('preserves sequence name and custom delayMs in metadata', () => {
        const sequences: Sequence[] = [{ id: 0, steps: [{ kind: 'power_off_active' }], name: 'Night Mode', delayMs: 500 }];
        const wire = buildWireConfig([], sequences, [ROOT_STATE], 0, DEFAULT_COUNTERS);
        const parsed = parseWireConfig(wire);

        expect(parsed.sequences[0].name).toBe('Night Mode');
        expect(parsed.sequences[0].delayMs).toBe(500);
    });

    it('omits sequences with default delayMs and no name from metadata', () => {
        const sequences: Sequence[] = [{ id: 0, steps: [{ kind: 'power_off_active' }], delayMs: 200 }];
        const wire = buildWireConfig([], sequences, [ROOT_STATE], 0, DEFAULT_COUNTERS);

        expect(wire.metadata.sequenceMetadata).toHaveLength(0);
    });

    it('round-trips physical button assignments on a state', () => {
        const state: State = {
            ...ROOT_STATE,
            physicalButtons: [{
                buttonCode: ButtonCode.VOL_UP,
                assignment: { kind: 'action', deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_NAVIGATE, data: 0 },
            }],
        };
        const wire = buildWireConfig([], [], [state], 0, DEFAULT_COUNTERS);
        const parsed = parseWireConfig(wire);

        expect(parsed.states[0].physicalButtons).toHaveLength(1);
        expect(parsed.states[0].physicalButtons[0].buttonCode).toBe(ButtonCode.VOL_UP);
    });

    it('round-trips screen button assignments on a state', () => {
        const state: State = {
            ...ROOT_STATE,
            screenButtons: [{ id: 1, label: 'TV On', assignment: null }],
        };
        const wire = buildWireConfig([], [], [state], 0, DEFAULT_COUNTERS);
        const parsed = parseWireConfig(wire);

        expect(parsed.states[0].screenButtons).toHaveLength(1);
        expect(parsed.states[0].screenButtons[0].label).toBe('TV On');
    });
});
