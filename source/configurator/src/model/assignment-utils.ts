import { materialize } from '@model/materialize.ts';
import type { Action, IRCode, Sequence, SequenceAnnotation, SequenceId } from '@model/actions.ts';
import type { RemoteConfig, State } from '@model/state.ts';
import type { ActionPickerSelection } from '@model/configurator-types.ts';

export function nextSequenceId(config: RemoteConfig): SequenceId {
    return config.sequences.length > 0
        ? Math.max(...config.sequences.map(s => s.id)) + 1
        : 1;
}

export function selectionToAction(
    selection: ActionPickerSelection,
    irCodes: IRCode[]
): { action: Action; newIRCode?: IRCode } {
    if (selection.kind === 'device') {
        return materialize(selection.deviceFunction.template, irCodes);
    }

    if (selection.kind === 'navigate') {
        return {
            action: {
                type: 'navigate',
                params: [selection.targetStateId & 0xff, (selection.targetStateId >> 8) & 0xff, 0, 0],
            },
        };
    }

    return {
        action: {
            type: 'pause',
            params: [selection.durationMs & 0xff, (selection.durationMs >> 8) & 0xff, 0, 0],
        },
    };
}

export function materializeSteps(
    steps: ActionPickerSelection[],
    irCodes: IRCode[]
): { actions: Action[]; newIRCodes: IRCode[] } {
    const actions: Action[] = [];
    const newIRCodes: IRCode[] = [];
    let currentIRCodes = irCodes;

    for (const step of steps) {
        const { action, newIRCode } = selectionToAction(step, currentIRCodes);
        actions.push(action);

        if (newIRCode) {
            newIRCodes.push(newIRCode);
            currentIRCodes = [...currentIRCodes, newIRCode];
        }
    }

    return { actions, newIRCodes };
}

export function garbageCollect(config: RemoteConfig): RemoteConfig {
    const usedSequenceIds = new Set<SequenceId>();

    for (const state of config.states) {
        for (const physicalButton of state.physicalButtons) {
            usedSequenceIds.add(physicalButton.sequenceId);
        }

        for (const screenButton of state.screenButtons) {
            if (screenButton.sequenceId !== 0) {
                usedSequenceIds.add(screenButton.sequenceId);
            }
        }

        if (state.onActivate !== null) {
            usedSequenceIds.add(state.onActivate);
        }

        if (state.onDeactivate !== null) {
            usedSequenceIds.add(state.onDeactivate);
        }
    }

    const namedSequenceIds = new Set(
        config.metadata.sequenceAnnotations
            .filter(a => a.name !== undefined)
            .map(a => a.sequenceId)
    );

    const shouldKeep = (id: SequenceId) => usedSequenceIds.has(id) || namedSequenceIds.has(id);

    return {
        ...config,
        sequences: config.sequences.filter(s => shouldKeep(s.id)),
        metadata: {
            ...config.metadata,
            sequenceAnnotations: config.metadata.sequenceAnnotations.filter(a => shouldKeep(a.sequenceId)),
        },
    };
}

export function assignmentLabel(
    sequence: Sequence,
    annotation: SequenceAnnotation,
    config: RemoteConfig
): string {
    if (annotation.name) {
        return annotation.name;
    }

    if (annotation.deviceId && annotation.functionName) {
        const device = config.metadata.devices.find(d => d.id === annotation.deviceId);
        return `${device?.name ?? 'Unknown'} → ${annotation.functionName}`;
    }

    if (sequence.actions.length === 1) {
        const action = sequence.actions[0];

        if (action.type === 'navigate') {
            const targetStateId = action.params[0] | (action.params[1] << 8);
            const targetState = config.states.find(s => s.id === targetStateId);
            return `Navigate → ${targetState?.name ?? 'Unknown'}`;
        }

        if (action.type === 'pause') {
            const durationMs = action.params[0] | (action.params[1] << 8);
            return `Pause ${durationMs}ms`;
        }
    }

    return `${sequence.actions.length} actions`;
}

// Best-effort reverse lookup: reconstructs ActionPickerSelections from Actions.
// Actions for IR codes not matched to any installed device are dropped.
export function reconstructSteps(sequence: Sequence, config: RemoteConfig): ActionPickerSelection[] {
    const steps: ActionPickerSelection[] = [];

    for (const action of sequence.actions) {
        if (action.type === 'navigate') {
            steps.push({ kind: 'navigate', targetStateId: action.params[0] | (action.params[1] << 8) });
            continue;
        }

        if (action.type === 'pause') {
            steps.push({ kind: 'pause', durationMs: action.params[0] | (action.params[1] << 8) });
            continue;
        }

        if (action.type === 'ir_send') {
            const irCodeId = action.params[0] | (action.params[1] << 8);
            const irCode = config.irCodes.find(c => c.id === irCodeId);

            if (!irCode) {
                continue;
            }

            for (const device of config.metadata.devices) {
                const deviceFunction = device.functions.find(fn =>
                    fn.template.type === 'ir_send' &&
                    fn.template.protocol === irCode.protocol &&
                    fn.template.code === irCode.code
                );

                if (deviceFunction) {
                    steps.push({ kind: 'device', device, deviceFunction });
                    break;
                }
            }
        }
    }

    return steps;
}

export function findButtonsUsingSequence(
    sequenceId: SequenceId,
    config: RemoteConfig,
    buttonFriendlyName: (buttonCode: string) => string
): Array<{ stateName: string; buttonLabel: string }> {
    const references: Array<{ stateName: string; buttonLabel: string }> = [];

    for (const state of config.states) {
        for (const physicalButton of state.physicalButtons) {
            if (physicalButton.sequenceId === sequenceId) {
                references.push({
                    stateName: state.name,
                    buttonLabel: buttonFriendlyName(physicalButton.buttonCode),
                });
            }
        }

        for (const screenButton of state.screenButtons) {
            if (screenButton.sequenceId === sequenceId) {
                references.push({
                    stateName: state.name,
                    buttonLabel: screenButton.label,
                });
            }
        }
    }

    return references;
}

// Shared mutation: create and assign a new single-action sequence to a button,
// replacing the previous sequenceId (0 = unassigned). Caller provides a function
// to splice the new SequenceId into the relevant button config in the state.
export function buildSingleActionConfig(
    selection: ActionPickerSelection,
    previousSequenceId: SequenceId | null,
    config: RemoteConfig,
    applyButtonSequenceId: (config: RemoteConfig, newSequenceId: SequenceId) => RemoteConfig
): RemoteConfig {
    const { action, newIRCode } = selectionToAction(selection, config.irCodes);
    const newSequenceId = nextSequenceId(config);
    const newSequence: Sequence = { id: newSequenceId, actions: [action] };
    const newAnnotation: SequenceAnnotation = {
        sequenceId: newSequenceId,
        deviceId: selection.kind === 'device' ? selection.device.id : undefined,
        functionName: selection.kind === 'device' ? selection.deviceFunction.name : undefined,
    };

    let updated = applyButtonSequenceId({
        ...config,
        sequences: [...config.sequences, newSequence],
        irCodes: newIRCode ? [...config.irCodes, newIRCode] : config.irCodes,
        metadata: {
            ...config.metadata,
            sequenceAnnotations: [...config.metadata.sequenceAnnotations, newAnnotation],
        },
    }, newSequenceId);

    if (previousSequenceId !== null) {
        updated = garbageCollect(updated);
    }

    return updated;
}

export function buildMultiActionConfig(
    steps: ActionPickerSelection[],
    name: string | undefined,
    previousSequenceId: SequenceId | null,
    config: RemoteConfig,
    applyButtonSequenceId: (config: RemoteConfig, newSequenceId: SequenceId) => RemoteConfig
): RemoteConfig {
    const { actions, newIRCodes } = materializeSteps(steps, config.irCodes);
    const newSequenceId = nextSequenceId(config);
    const newSequence: Sequence = { id: newSequenceId, actions };
    const newAnnotation: SequenceAnnotation = { sequenceId: newSequenceId, name };

    let updated = applyButtonSequenceId({
        ...config,
        sequences: [...config.sequences, newSequence],
        irCodes: newIRCodes.length > 0 ? [...config.irCodes, ...newIRCodes] : config.irCodes,
        metadata: {
            ...config.metadata,
            sequenceAnnotations: [...config.metadata.sequenceAnnotations, newAnnotation],
        },
    }, newSequenceId);

    if (previousSequenceId !== null) {
        updated = garbageCollect(updated);
    }

    return updated;
}
