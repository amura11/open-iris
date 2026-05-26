import type { Device, Sequence, SequenceStep, State, StateId, ButtonAssignment, PhysicalButton } from '@model/configurator-types.ts';
import { ButtonCode } from '@model/button-codes.ts';
import type {
    WireConfig, WireIdCounters, WireDevice, WireDeviceFunction,
    WireDeviceMetadata, WireFunctionMetadata, WireSequence,
    WireSequenceMetadata, WireState, WireJsonObject,
} from '@model/wire-types.ts';
import {
    SYSTEM_DEVICE_ID, SYSTEM_FN_NAVIGATE, SYSTEM_FN_PAUSE, SYSTEM_FN_POWER_OFF_ACTIVE, IRIS_NO_ID,
} from '@model/serialization.ts';

type WireAction = WireConfig['sequences'][number]['actions'][number];

// ── Wire → UI conversion ──────────────────────────────────────────────────────

export function wireActionToStep(action: WireAction, devices: Device[]): SequenceStep[] {
    if (action.deviceId === SYSTEM_DEVICE_ID) {
        if (action.functionId === SYSTEM_FN_NAVIGATE) {
            return [{ kind: 'navigate', targetStateId: action.data }];
        }

        if (action.functionId === SYSTEM_FN_PAUSE) {
            return [{ kind: 'pause', durationMs: action.data }];
        }

        return [{ kind: 'power_off_active' }];
    }

    const device = devices.find(d => d.id === action.deviceId);
    const deviceFunction = device?.functions.find(f => f.id === action.functionId);

    return device && deviceFunction ? [{ kind: 'device', device, deviceFunction }] : [];
}

// ── UI → Wire conversion ──────────────────────────────────────────────────────

export function stepToWireAction(step: SequenceStep): WireAction {
    if (step.kind === 'device') {
        return { deviceId: step.device.id, functionId: step.deviceFunction.id, data: IRIS_NO_ID };
    }

    if (step.kind === 'navigate') {
        return { deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_NAVIGATE, data: step.targetStateId };
    }

    if (step.kind === 'pause') {
        return { deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_PAUSE, data: step.durationMs };
    }

    return { deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_POWER_OFF_ACTIVE, data: IRIS_NO_ID };
}

// ── Assignment helpers ─────────────────────────────────────────────────────────

export function stepToAssignment(step: SequenceStep): ButtonAssignment {
    const wireAction = stepToWireAction(step);
    return { kind: 'action', deviceId: wireAction.deviceId, functionId: wireAction.functionId, data: wireAction.data };
}

export function withPhysicalButton(
    buttons: PhysicalButton[],
    buttonCode: ButtonCode,
    assignment: ButtonAssignment,
): PhysicalButton[] {
    const newEntry: PhysicalButton = { buttonCode, assignment };

    if (buttons.some(b => b.buttonCode === buttonCode)) {
        return buttons.map(b => b.buttonCode === buttonCode ? newEntry : b);
    }

    return [...buttons, newEntry];
}

// ── Full config mapping ───────────────────────────────────────────────────────

export interface ParsedWireConfig {
    devices:     Device[];
    sequences:   Sequence[];
    states:      State[];
    rootStateId: StateId;
    idCounters:  WireIdCounters;
}

export function buildWireConfig(
    devices: Device[],
    sequences: Sequence[],
    states: State[],
    rootStateId: StateId,
    idCounters: WireIdCounters,
): WireConfig {
    const wireDevices: WireDevice[] = devices.map(device => ({
        id:                 device.id,
        name:               device.name,
        type:               device.type,
        powerMode:          device.powerMode,
        powerOnFunctionId:  device.powerOnFunctionId,
        powerOffFunctionId: device.powerOffFunctionId,
    }));

    const wireFunctions: WireDeviceFunction[] = devices.flatMap(device =>
        device.functions.map(deviceFunction => ({
            id:       deviceFunction.id,
            deviceId: deviceFunction.deviceId,
            name:     deviceFunction.name,
            data:     deviceFunction.data,
        }))
    );

    const wireDeviceMetadata: WireDeviceMetadata[] = devices.map(device => ({
        id:           device.id,
        manufacturer: device.manufacturer,
        sourceId:     device.sourceId,
    }));

    const wireFunctionMetadata: WireFunctionMetadata[] = devices.flatMap(device =>
        device.functions.map(deviceFunction => ({
            id:       deviceFunction.id,
            sourceId: deviceFunction.sourceId,
        }))
    );

    const wireSequences: WireSequence[] = sequences.map(sequence => ({
        id:      sequence.id,
        actions: sequence.steps.map(stepToWireAction),
    }));

    const wireSequenceMetadata: WireSequenceMetadata[] = sequences
        .filter(sequence => sequence.name !== undefined || sequence.delayMs !== 200)
        .map(sequence => ({
            sequenceId: sequence.id,
            ...(sequence.name !== undefined ? { name: sequence.name }     : {}),
            ...(sequence.delayMs !== 200    ? { delayMs: sequence.delayMs } : {}),
        }));

    const wireStates: WireState[] = states.map(state => ({
        id:              state.id,
        name:            state.name,
        stateType:       state.stateType,
        buttonFallback:  state.buttonFallback,
        activeDevices:   state.activeDevices,
        onActivate:      state.onActivate,
        onDeactivate:    state.onDeactivate,
        physicalButtons: state.physicalButtons.map(physicalButton => ({
            buttonCode: physicalButton.buttonCode,
            assignment: physicalButton.assignment,
        })),
        screenButtons: state.screenButtons.map(screenButton => ({
            id:         screenButton.id,
            label:      screenButton.label,
            icon:       screenButton.icon,
            assignment: screenButton.assignment,
        })),
    }));

    return {
        rootStateId,
        states:     wireStates,
        sequences:  wireSequences,
        devices:    wireDevices,
        functions:  wireFunctions,
        dataBlocks: [],
        metadata: {
            idCounters,
            deviceMetadata:   wireDeviceMetadata,
            functionMetadata: wireFunctionMetadata,
            sequenceMetadata: wireSequenceMetadata,
            extra:            {} as WireJsonObject,
        },
    };
}

export function parseWireConfig(config: WireConfig): ParsedWireConfig {
    const devices: Device[] = config.devices.map(wireDevice => {
        const metadata  = config.metadata.deviceMetadata.find(m => m.id === wireDevice.id);
        const functions = config.functions
            .filter(wireFunction => wireFunction.deviceId === wireDevice.id)
            .map(wireFunction => {
                const functionMetadata = config.metadata.functionMetadata.find(m => m.id === wireFunction.id);
                return {
                    id:       wireFunction.id,
                    deviceId: wireFunction.deviceId,
                    name:     wireFunction.name,
                    data:     wireFunction.data,
                    sourceId: functionMetadata?.sourceId,
                };
            });

        return {
            id:                 wireDevice.id,
            name:               wireDevice.name,
            type:               wireDevice.type,
            powerMode:          wireDevice.powerMode,
            powerOnFunctionId:  wireDevice.powerOnFunctionId,
            powerOffFunctionId: wireDevice.powerOffFunctionId,
            manufacturer:       metadata?.manufacturer ?? '',
            sourceId:           metadata?.sourceId,
            functions,
        };
    });

    const sequences: Sequence[] = config.sequences.map(wireSequence => {
        const metadata = config.metadata.sequenceMetadata.find(m => m.sequenceId === wireSequence.id);
        const steps    = wireSequence.actions.flatMap(action => wireActionToStep(action, devices));
        return {
            id:      wireSequence.id,
            name:    metadata?.name,
            delayMs: metadata?.delayMs ?? 200,
            steps,
        };
    });

    const states: State[] = config.states.map(wireState => ({
        id:              wireState.id,
        name:            wireState.name,
        stateType:       wireState.stateType,
        buttonFallback:  wireState.buttonFallback,
        activeDevices:   wireState.activeDevices,
        onActivate:      wireState.onActivate,
        onDeactivate:    wireState.onDeactivate,
        physicalButtons: wireState.physicalButtons.map(physicalButton => ({
            buttonCode: physicalButton.buttonCode,
            assignment: physicalButton.assignment,
        })),
        screenButtons: wireState.screenButtons.map(screenButton => ({
            id:         screenButton.id,
            label:      screenButton.label,
            icon:       screenButton.icon,
            assignment: screenButton.assignment,
        })),
    }));

    return {
        devices,
        sequences,
        states,
        rootStateId: config.rootStateId,
        idCounters:  config.metadata.idCounters,
    };
}
