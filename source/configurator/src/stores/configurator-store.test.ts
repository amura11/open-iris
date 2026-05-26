import { describe, it, expect, beforeEach } from 'vitest';
import { ConfiguratorStore, stepToWireAction } from './configurator-store.svelte.ts';
import type { State, SequenceStep } from '@model/configurator-types.ts';
import type { DeviceTemplate } from '@model/device-catalog-types.ts';
import {
    SYSTEM_DEVICE_ID, SYSTEM_FN_NAVIGATE, SYSTEM_FN_PAUSE, SYSTEM_FN_POWER_OFF_ACTIVE, IRIS_NO_ID,
} from '@model/serialization.ts';

function makeStateDraft(name: string, overrides: Partial<State> = {}): State {
    return {
        id:              0,
        name,
        stateType:       'persistent',
        screenButtons:   [],
        physicalButtons: [],
        onActivate:      null,
        onDeactivate:    null,
        buttonFallback:  false,
        activeDevices:   [],
        ...overrides,
    };
}

function makeDeviceTemplate(name: string, manufacturer: string): DeviceTemplate {
    return {
        identifier:              `${manufacturer}-${name}`,
        name,
        manufacturer,
        type:                    'ir',
        providerName:            'Test',
        allowsMultipleInstances: false,
        functions: [{
            name: 'Power',
            data: { type: 'ir', protocol: 'nec', code: BigInt(0x12345678) },
        }],
    };
}

// ── stepToWireAction ──────────────────────────────────────────────────────────

describe('stepToWireAction', () => {
    it('converts a device step', () => {
        const device = {
            id: 1, name: 'TV', type: 'ir' as const, powerMode: 'none' as const, manufacturer: 'Sony', functions: [],
        };
        const deviceFunction = {
            id: 10, deviceId: 1, name: 'Power', data: { type: 'ir' as const, protocol: 'nec' as const, code: 0n },
        };

        const action = stepToWireAction({ kind: 'device', device, deviceFunction });

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

// ── ConfiguratorStore — state management ─────────────────────────────────────

describe('ConfiguratorStore — state management', () => {
    let store: ConfiguratorStore;

    beforeEach(() => {
        store = new ConfiguratorStore();
    });

    it('initialises with a single root state named Home', () => {
        expect(store.states).toHaveLength(1);
        expect(store.states[0].name).toBe('Home');
        expect(store.states[0].stateType).toBe('root');
        expect(store.rootStateId).toBe(0);
    });

    it('addState appends the state and returns the assigned ID', () => {
        const newId = store.addState(makeStateDraft('Movie Mode'));

        expect(store.states).toHaveLength(2);
        expect(store.states.find(state => state.id === newId)?.name).toBe('Movie Mode');
    });

    it('addState ignores the draft id and assigns a fresh one', () => {
        const newId = store.addState(makeStateDraft('Test', { id: 9999 }));

        expect(newId).not.toBe(9999);
        expect(store.states.find(state => state.id === 9999)).toBeUndefined();
    });

    it('updateState replaces the state with the matching id', () => {
        const newId = store.addState(makeStateDraft('Original'));
        store.updateState({ ...makeStateDraft('Updated'), id: newId });

        expect(store.states.find(state => state.id === newId)?.name).toBe('Updated');
    });

    it('deleteState removes the state and resets selectedStateId to rootStateId', () => {
        const newId = store.addState(makeStateDraft('Temporary'));
        store.selectState(newId);
        store.deleteState(newId);

        expect(store.states.find(state => state.id === newId)).toBeUndefined();
        expect(store.selectedStateId).toBe(store.rootStateId);
    });

    it('selectState updates selectedStateId', () => {
        const newId = store.addState(makeStateDraft('Second'));
        store.selectState(newId);

        expect(store.selectedStateId).toBe(newId);
    });
});

// ── ConfiguratorStore — sequence management ───────────────────────────────────

describe('ConfiguratorStore — sequence management', () => {
    let store: ConfiguratorStore;

    beforeEach(() => {
        store = new ConfiguratorStore();
    });

    it('addSequence appends the sequence and returns the assigned ID', () => {
        const steps: SequenceStep[] = [{ kind: 'navigate', targetStateId: 0 }];
        const sequenceId = store.addSequence(steps, 'My Sequence', 300);

        expect(store.sequences).toHaveLength(1);
        expect(store.sequences[0].id).toBe(sequenceId);
        expect(store.sequences[0].name).toBe('My Sequence');
        expect(store.sequences[0].delayMs).toBe(300);
        expect(store.sequences[0].steps).toEqual(steps);
    });

    it('addSequence defaults delayMs to 200 when omitted', () => {
        store.addSequence([{ kind: 'pause', durationMs: 100 }]);

        expect(store.sequences[0].delayMs).toBe(200);
    });

    it('updateSequence replaces steps, name, and delayMs', () => {
        const sequenceId = store.addSequence([{ kind: 'pause', durationMs: 100 }], 'Old', 200);
        const newSteps: SequenceStep[] = [{ kind: 'navigate', targetStateId: 0 }];
        store.updateSequence(sequenceId, newSteps, 'New', 500);

        const updated = store.sequences.find(sequence => sequence.id === sequenceId);
        expect(updated?.name).toBe('New');
        expect(updated?.delayMs).toBe(500);
        expect(updated?.steps).toEqual(newSteps);
    });

    it('deleteAnonymousSequence removes sequences without a name', () => {
        const sequenceId = store.addSequence([{ kind: 'pause', durationMs: 100 }]);
        store.deleteAnonymousSequence(sequenceId);

        expect(store.sequences.find(sequence => sequence.id === sequenceId)).toBeUndefined();
    });

    it('deleteAnonymousSequence preserves named sequences', () => {
        const sequenceId = store.addSequence([{ kind: 'pause', durationMs: 100 }], 'Keep Me');
        store.deleteAnonymousSequence(sequenceId);

        expect(store.sequences.find(sequence => sequence.id === sequenceId)).toBeDefined();
    });
});

// ── ConfiguratorStore — device management ────────────────────────────────────

describe('ConfiguratorStore — device management', () => {
    let store: ConfiguratorStore;

    beforeEach(() => {
        store = new ConfiguratorStore();
    });

    it('addDevice creates a device from a template', () => {
        store.addDevice(makeDeviceTemplate('TV', 'Sony'));

        expect(store.devices).toHaveLength(1);
        expect(store.devices[0].name).toBe('TV');
        expect(store.devices[0].manufacturer).toBe('Sony');
        expect(store.devices[0].type).toBe('ir');
        expect(store.devices[0].functions).toHaveLength(1);
        expect(store.devices[0].functions[0].name).toBe('Power');
    });

    it('addDevice uses displayName when provided', () => {
        store.addDevice(makeDeviceTemplate('TV', 'Sony'), 'Living Room TV');

        expect(store.devices[0].name).toBe('Living Room TV');
    });

    it('addDevice blocks a second instance when allowsMultipleInstances is false', () => {
        const template = makeDeviceTemplate('TV', 'Sony');
        store.addDevice(template);
        store.addDevice(template);

        expect(store.devices).toHaveLength(1);
    });

    it('addDevice allows multiple instances when the template permits it', () => {
        const template: DeviceTemplate = { ...makeDeviceTemplate('TV', 'Sony'), allowsMultipleInstances: true };
        store.addDevice(template);
        store.addDevice(template);

        expect(store.devices).toHaveLength(2);
    });

    it('removeDevice removes the device by ID', () => {
        store.addDevice(makeDeviceTemplate('TV', 'Sony'));
        const deviceId = store.devices[0].id;
        store.removeDevice(deviceId);

        expect(store.devices).toHaveLength(0);
    });

    it('renameDevice updates only the device name', () => {
        store.addDevice(makeDeviceTemplate('TV', 'Sony'));
        const deviceId = store.devices[0].id;
        store.renameDevice(deviceId, 'Bedroom TV');

        expect(store.devices[0].name).toBe('Bedroom TV');
        expect(store.devices[0].manufacturer).toBe('Sony');
    });
});

// ── ConfiguratorStore — wire round-trip ──────────────────────────────────────

describe('ConfiguratorStore — toWireConfig / loadFromWireConfig round-trip', () => {
    it('restores states, devices, sequences, and rootStateId', () => {
        const originalStore = new ConfiguratorStore();
        originalStore.addDevice(makeDeviceTemplate('TV', 'Sony'));
        const movieStateId = originalStore.addState(makeStateDraft('Movie Mode'));
        originalStore.addSequence([{ kind: 'navigate', targetStateId: movieStateId }], 'Go Movies', 250);

        const wireConfig = originalStore.toWireConfig();

        const restoredStore = new ConfiguratorStore();
        restoredStore.loadFromWireConfig(wireConfig);

        expect(restoredStore.rootStateId).toBe(originalStore.rootStateId);
        expect(restoredStore.states.map(state => state.name)).toEqual(originalStore.states.map(state => state.name));
        expect(restoredStore.devices.map(device => device.name)).toEqual(originalStore.devices.map(device => device.name));
        expect(restoredStore.devices[0].manufacturer).toBe('Sony');
        expect(restoredStore.sequences.map(sequence => sequence.name)).toEqual(originalStore.sequences.map(sequence => sequence.name));
        expect(restoredStore.sequences[0].delayMs).toBe(250);
    });
});
