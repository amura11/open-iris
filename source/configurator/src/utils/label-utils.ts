import type { ButtonAssignment, Device, Sequence, SequenceStep, State } from '@model/configurator-types.ts';
import {
    SYSTEM_DEVICE_ID, SYSTEM_FN_NAVIGATE, SYSTEM_FN_PAUSE,
} from '@model/serialization.ts';

export function assignmentLabel(
    assignment: ButtonAssignment,
    devices:    Device[],
    sequences:  Sequence[],
    states:     State[],
): string {
    if (assignment.kind === 'action') {
        return actionLabel(assignment, devices, states);
    }

    const sequence = sequences.find(s => s.id === assignment.sequenceId);

    if (sequence?.name) {
        return sequence.name;
    }

    if (sequence && sequence.steps.length === 1) {
        return stepLabel(sequence.steps[0], states);
    }

    return sequence ? `${sequence.steps.length} actions` : 'Unknown sequence';
}

function actionLabel(
    action:  { deviceId: number; functionId: number; data: number },
    devices: Device[],
    states:  State[],
): string {
    if (action.deviceId === SYSTEM_DEVICE_ID) {
        if (action.functionId === SYSTEM_FN_NAVIGATE) {
            const state = states.find(s => s.id === action.data);
            return `Navigate → ${state?.name ?? 'Unknown'}`;
        }

        if (action.functionId === SYSTEM_FN_PAUSE) {
            return `Pause ${action.data}ms`;
        }

        return 'Power off active devices';
    }

    const device = devices.find(d => d.id === action.deviceId);
    const deviceFunction = device?.functions.find(f => f.id === action.functionId);

    return `${device?.name ?? 'Unknown'} → ${deviceFunction?.name ?? 'Unknown'}`;
}

function stepLabel(step: SequenceStep, states: State[]): string {
    if (step.kind === 'device') {
        return `${step.device.name} → ${step.deviceFunction.name}`;
    }

    if (step.kind === 'navigate') {
        const state = states.find(s => s.id === step.targetStateId);
        return `Navigate → ${state?.name ?? 'Unknown'}`;
    }

    if (step.kind === 'pause') {
        return `Pause ${step.durationMs}ms`;
    }

    return 'Power off active devices';
}
