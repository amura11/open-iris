import { describe, it, expect, beforeEach } from 'vitest';
import { ConfiguratorStore } from './configurator-store.svelte.ts';
import type { State, SequenceStep, PhysicalButton, ScreenButton } from '@model/configurator-types.ts';
import type { DeviceTemplate } from '@model/device-catalog-types.ts';
import { ButtonCode } from '@model/button-codes.ts';
import {
    SYSTEM_DEVICE_ID, SYSTEM_FN_NAVIGATE, SYSTEM_FN_PAUSE, SYSTEM_FN_POWER_OFF_ACTIVE,
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

// ── ConfiguratorStore — physical button assignment ───────────────────────────

describe('ConfiguratorStore — physical button assignment', () => {
    let store: ConfiguratorStore;
    const navigateStep: SequenceStep = { kind: 'navigate', targetStateId: 0 };

    beforeEach(() => {
        store = new ConfiguratorStore();
    });

    it('assignPhysicalButtonAction sets an action assignment on an unassigned button', () => {
        store.assignPhysicalButtonAction(ButtonCode.VOL_UP, navigateStep);

        const assignment = store.selectedState.physicalButtons.find(b => b.buttonCode === ButtonCode.VOL_UP)?.assignment;
        expect(assignment?.kind).toBe('action');
        expect(assignment).toMatchObject({ kind: 'action', deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_NAVIGATE, data: 0 });
    });

    it('assignPhysicalButtonAction replaces an existing action assignment', () => {
        store.assignPhysicalButtonAction(ButtonCode.VOL_UP, navigateStep);
        store.assignPhysicalButtonAction(ButtonCode.VOL_UP, { kind: 'pause', durationMs: 500 });

        const assignment = store.selectedState.physicalButtons.find(b => b.buttonCode === ButtonCode.VOL_UP)?.assignment;
        expect(assignment).toMatchObject({ kind: 'action', functionId: SYSTEM_FN_PAUSE, data: 500 });
    });

    it('assignPhysicalButtonAction deletes a previous anonymous sequence', () => {
        const sequenceId = store.addSequence([navigateStep]);
        store.updateState({
            ...store.selectedState,
            physicalButtons: [{ buttonCode: ButtonCode.MUTE, assignment: { kind: 'sequence', sequenceId } }],
        });

        store.assignPhysicalButtonAction(ButtonCode.MUTE, { kind: 'pause', durationMs: 100 });

        expect(store.sequences.find(s => s.id === sequenceId)).toBeUndefined();
    });

    it('assignPhysicalButtonAction preserves a previous named sequence', () => {
        const sequenceId = store.addSequence([navigateStep], 'Named');
        store.updateState({
            ...store.selectedState,
            physicalButtons: [{ buttonCode: ButtonCode.MUTE, assignment: { kind: 'sequence', sequenceId } }],
        });

        store.assignPhysicalButtonAction(ButtonCode.MUTE, { kind: 'pause', durationMs: 100 });

        expect(store.sequences.find(s => s.id === sequenceId)).toBeDefined();
    });

    it('assignPhysicalButtonAnonymousSequence creates a new sequence and assigns it', () => {
        const steps: SequenceStep[] = [navigateStep, { kind: 'pause', durationMs: 200 }];
        store.assignPhysicalButtonAnonymousSequence(ButtonCode.VOL_UP, steps, undefined, 300);

        expect(store.sequences).toHaveLength(1);
        const assignment = store.selectedState.physicalButtons.find(b => b.buttonCode === ButtonCode.VOL_UP)?.assignment;
        expect(assignment?.kind).toBe('sequence');
    });

    it('assignPhysicalButtonAnonymousSequence reuses the existing sequence when replacing', () => {
        store.assignPhysicalButtonAnonymousSequence(ButtonCode.VOL_UP, [navigateStep], undefined, 200);
        const firstSequenceId = (store.selectedState.physicalButtons[0].assignment as { kind: 'sequence'; sequenceId: number }).sequenceId;

        store.assignPhysicalButtonAnonymousSequence(ButtonCode.VOL_UP, [{ kind: 'pause', durationMs: 100 }], undefined, 200);
        const secondSequenceId = (store.selectedState.physicalButtons[0].assignment as { kind: 'sequence'; sequenceId: number }).sequenceId;

        expect(secondSequenceId).toBe(firstSequenceId);
        expect(store.sequences).toHaveLength(1);
    });

    it('assignPhysicalButtonAnonymousSequence does nothing when steps is empty', () => {
        store.assignPhysicalButtonAnonymousSequence(ButtonCode.VOL_UP, [], undefined, 200);

        expect(store.sequences).toHaveLength(0);
        expect(store.selectedState.physicalButtons).toHaveLength(0);
    });

    it('assignPhysicalButtonNamedSequence assigns the sequence reference', () => {
        const sequenceId = store.addSequence([navigateStep], 'My Macro');
        store.assignPhysicalButtonNamedSequence(ButtonCode.HOME, sequenceId);

        const assignment = store.selectedState.physicalButtons.find(b => b.buttonCode === ButtonCode.HOME)?.assignment;
        expect(assignment).toEqual({ kind: 'sequence', sequenceId });
    });

    it('assignPhysicalButtonNamedSequence deletes a different previous anonymous sequence', () => {
        const oldId = store.addSequence([navigateStep]);
        store.updateState({
            ...store.selectedState,
            physicalButtons: [{ buttonCode: ButtonCode.HOME, assignment: { kind: 'sequence', sequenceId: oldId } }],
        });
        const newId = store.addSequence([{ kind: 'pause', durationMs: 100 }], 'New Named');

        store.assignPhysicalButtonNamedSequence(ButtonCode.HOME, newId);

        expect(store.sequences.find(s => s.id === oldId)).toBeUndefined();
    });

    it('removePhysicalButtonAssignment removes the button entry', () => {
        store.assignPhysicalButtonAction(ButtonCode.POWER, navigateStep);
        store.removePhysicalButtonAssignment(ButtonCode.POWER);

        expect(store.selectedState.physicalButtons.find(b => b.buttonCode === ButtonCode.POWER)).toBeUndefined();
    });

    it('removePhysicalButtonAssignment deletes an anonymous sequence', () => {
        store.assignPhysicalButtonAnonymousSequence(ButtonCode.BACK, [navigateStep], undefined, 200);
        const sequenceId = (store.selectedState.physicalButtons[0].assignment as { kind: 'sequence'; sequenceId: number }).sequenceId;

        store.removePhysicalButtonAssignment(ButtonCode.BACK);

        expect(store.sequences.find(s => s.id === sequenceId)).toBeUndefined();
    });
});

// ── ConfiguratorStore — screen button assignment ──────────────────────────────

describe('ConfiguratorStore — screen button assignment', () => {
    let store: ConfiguratorStore;
    const pauseStep: SequenceStep = { kind: 'pause', durationMs: 500 };

    function addScreenButton(storeInstance: ConfiguratorStore): ScreenButton {
        const button: ScreenButton = { id: 1, label: 'Test', assignment: null };
        storeInstance.updateState({ ...storeInstance.selectedState, screenButtons: [button] });
        return button;
    }

    beforeEach(() => {
        store = new ConfiguratorStore();
    });

    it('assignScreenButtonAction sets an action assignment', () => {
        const button = addScreenButton(store);
        store.assignScreenButtonAction(button.id, pauseStep);

        const assignment = store.selectedState.screenButtons[0].assignment;
        expect(assignment).toMatchObject({ kind: 'action', functionId: SYSTEM_FN_PAUSE, data: 500 });
    });

    it('assignScreenButtonAction deletes a previous anonymous sequence', () => {
        const button = addScreenButton(store);
        const sequenceId = store.addSequence([pauseStep]);
        store.updateState({
            ...store.selectedState,
            screenButtons: [{ ...button, assignment: { kind: 'sequence', sequenceId } }],
        });

        store.assignScreenButtonAction(button.id, { kind: 'navigate', targetStateId: 0 });

        expect(store.sequences.find(s => s.id === sequenceId)).toBeUndefined();
    });

    it('assignScreenButtonAnonymousSequence creates a sequence and assigns it', () => {
        const button = addScreenButton(store);
        store.assignScreenButtonAnonymousSequence(button.id, [pauseStep], undefined, 200);

        expect(store.sequences).toHaveLength(1);
        expect(store.selectedState.screenButtons[0].assignment?.kind).toBe('sequence');
    });

    it('assignScreenButtonAnonymousSequence reuses the existing sequence when replacing', () => {
        const button = addScreenButton(store);
        store.assignScreenButtonAnonymousSequence(button.id, [pauseStep], undefined, 200);
        const firstId = (store.selectedState.screenButtons[0].assignment as { kind: 'sequence'; sequenceId: number }).sequenceId;

        store.assignScreenButtonAnonymousSequence(button.id, [{ kind: 'navigate', targetStateId: 0 }], undefined, 200);
        const secondId = (store.selectedState.screenButtons[0].assignment as { kind: 'sequence'; sequenceId: number }).sequenceId;

        expect(secondId).toBe(firstId);
        expect(store.sequences).toHaveLength(1);
    });

    it('assignScreenButtonNamedSequence assigns the sequence reference', () => {
        const button = addScreenButton(store);
        const sequenceId = store.addSequence([pauseStep], 'My Macro');
        store.assignScreenButtonNamedSequence(button.id, sequenceId);

        expect(store.selectedState.screenButtons[0].assignment).toEqual({ kind: 'sequence', sequenceId });
    });

    it('removeScreenButtonAssignment sets assignment to null', () => {
        const button = addScreenButton(store);
        store.assignScreenButtonAction(button.id, pauseStep);
        store.removeScreenButtonAssignment(button.id);

        expect(store.selectedState.screenButtons[0].assignment).toBeNull();
    });

    it('removeScreenButtonAssignment deletes an anonymous sequence', () => {
        const button = addScreenButton(store);
        store.assignScreenButtonAnonymousSequence(button.id, [pauseStep], undefined, 200);
        const sequenceId = (store.selectedState.screenButtons[0].assignment as { kind: 'sequence'; sequenceId: number }).sequenceId;

        store.removeScreenButtonAssignment(button.id);

        expect(store.sequences.find(s => s.id === sequenceId)).toBeUndefined();
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
