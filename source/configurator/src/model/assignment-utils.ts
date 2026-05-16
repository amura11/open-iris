import type { Action, Sequence, SequenceId, PhysicalButtonConfig, ScreenButtonConfig } from '@model/actions.ts';
import type { RemoteConfig, IdCounters, SequenceMetadata } from '@model/state.ts';
import type { ActionPickerSelection } from '@model/configurator-types.ts';
import {
    SYSTEM_DEVICE_ID, SYSTEM_FN_NAVIGATE, SYSTEM_FN_PAUSE, SYSTEM_FN_POWER_OFF_ACTIVE, IRIS_NO_ID,
} from '@model/serialization.ts';

// ── ID allocation ─────────────────────────────────────────────────────────────

export function nextId(config: RemoteConfig, counter: keyof IdCounters): number {
    return config.metadata.idCounters[counter];
}

export function consumeId(config: RemoteConfig, counter: keyof IdCounters): [number, RemoteConfig] {
    const id = config.metadata.idCounters[counter];
    return [id, {
        ...config,
        metadata: {
            ...config.metadata,
            idCounters: { ...config.metadata.idCounters, [counter]: id + 1 },
        },
    }];
}

// ── Action conversion ─────────────────────────────────────────────────────────

export function selectionToAction(sel: ActionPickerSelection): Action {
    if (sel.kind === 'device')
        return { deviceId: sel.device.id, functionId: sel.deviceFunction.id, data: IRIS_NO_ID };
    if (sel.kind === 'navigate')
        return { deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_NAVIGATE, data: sel.targetStateId };
    if (sel.kind === 'pause')
        return { deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_PAUSE, data: sel.durationMs };
    return { deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_POWER_OFF_ACTIVE, data: IRIS_NO_ID };
}

export function reconstructSteps(sequence: Sequence, config: RemoteConfig): ActionPickerSelection[] {
    return sequence.actions.flatMap((action): ActionPickerSelection[] => {
        if (action.deviceId === SYSTEM_DEVICE_ID) {
            if (action.functionId === SYSTEM_FN_NAVIGATE)
                return [{ kind: 'navigate', targetStateId: action.data }];
            if (action.functionId === SYSTEM_FN_PAUSE)
                return [{ kind: 'pause', durationMs: action.data }];
            return [{ kind: 'power_off_active' }];
        }
        const device = config.devices.find(d => d.id === action.deviceId);
        const fn     = config.functions.find(f => f.id === action.functionId);
        return device && fn ? [{ kind: 'device', device, deviceFunction: fn }] : [];
    });
}

// ── Button assignment label ───────────────────────────────────────────────────

type ButtonAssignment =
    | { kind: 'sequence'; sequenceId: SequenceId }
    | { kind: 'action';   deviceId: number; functionId: number; data: number };

export function assignmentLabel(assignment: ButtonAssignment, config: RemoteConfig): string {
    if (assignment.kind === 'action') {
        return actionLabel(assignment, config);
    }
    const meta = config.metadata.sequenceMetadata.find(m => m.sequenceId === assignment.sequenceId);
    if (meta?.name) return meta.name;
    const seq = config.sequences.find(s => s.id === assignment.sequenceId);
    if (seq && seq.actions.length === 1) return actionLabel(seq.actions[0], config);
    return seq ? `${seq.actions.length} actions` : 'Unknown sequence';
}

function actionLabel(action: { deviceId: number; functionId: number; data: number }, config: RemoteConfig): string {
    if (action.deviceId === SYSTEM_DEVICE_ID) {
        if (action.functionId === SYSTEM_FN_NAVIGATE) {
            const state = config.states.find(s => s.id === action.data);
            return `Navigate → ${state?.name ?? 'Unknown'}`;
        }
        if (action.functionId === SYSTEM_FN_PAUSE) return `Pause ${action.data}ms`;
        return 'Power off active devices';
    }
    const device = config.devices.find(d => d.id === action.deviceId);
    const fn     = config.functions.find(f => f.id === action.functionId);
    return `${device?.name ?? 'Unknown'} → ${fn?.name ?? 'Unknown'}`;
}

// ── Garbage collection ────────────────────────────────────────────────────────
// Collects orphaned anonymous sequences only. Devices, functions, and data
// blocks are library items and are never GC'd automatically.

export function garbageCollect(config: RemoteConfig): RemoteConfig {
    const usedSequenceIds = new Set<SequenceId>();

    for (const state of config.states) {
        for (const phys of state.physicalButtons) {
            if (phys.assignment.kind === 'sequence') usedSequenceIds.add(phys.assignment.sequenceId);
        }
        for (const screen of state.screenButtons) {
            if (screen.assignment?.kind === 'sequence') usedSequenceIds.add(screen.assignment.sequenceId);
        }
        if (state.onActivate   !== null) usedSequenceIds.add(state.onActivate);
        if (state.onDeactivate !== null) usedSequenceIds.add(state.onDeactivate);
    }

    const namedSequenceIds = new Set(
        config.metadata.sequenceMetadata
            .filter(m => m.name !== undefined)
            .map(m => m.sequenceId)
    );

    const shouldKeep = (id: SequenceId) => usedSequenceIds.has(id) || namedSequenceIds.has(id);

    return {
        ...config,
        sequences: config.sequences.filter(s => shouldKeep(s.id)),
        metadata: {
            ...config.metadata,
            sequenceMetadata: config.metadata.sequenceMetadata.filter(m => shouldKeep(m.sequenceId)),
        },
    };
}

// ── Button usage lookup ───────────────────────────────────────────────────────

export function findButtonsUsingSequence(
    sequenceId: SequenceId,
    config: RemoteConfig,
    buttonFriendlyName: (buttonCode: string) => string
): Array<{ stateName: string; buttonLabel: string }> {
    const references: Array<{ stateName: string; buttonLabel: string }> = [];

    for (const state of config.states) {
        for (const phys of state.physicalButtons) {
            if (phys.assignment.kind === 'sequence' && phys.assignment.sequenceId === sequenceId) {
                references.push({ stateName: state.name, buttonLabel: buttonFriendlyName(phys.buttonCode) });
            }
        }
        for (const screen of state.screenButtons) {
            if (screen.assignment?.kind === 'sequence' && screen.assignment.sequenceId === sequenceId) {
                references.push({ stateName: state.name, buttonLabel: screen.label });
            }
        }
    }

    return references;
}

// ── Button config builders ────────────────────────────────────────────────────

// Creates an inline single-action assignment (no wrapping sequence).
export function buildSingleActionConfig(
    selection: ActionPickerSelection,
    previousAssignment: ButtonAssignment | null,
    config: RemoteConfig,
    applyAssignment: (config: RemoteConfig, newAssignment: ButtonAssignment) => RemoteConfig
): RemoteConfig {
    const action = selectionToAction(selection);
    const inlineAssignment: ButtonAssignment = {
        kind:       'action',
        deviceId:   action.deviceId,
        functionId: action.functionId,
        data:       action.data,
    };
    let updated = applyAssignment(config, inlineAssignment);
    if (previousAssignment?.kind === 'sequence') {
        updated = garbageCollect(updated);
    }
    return updated;
}

// Creates a sequence and assigns it; adds SequenceMetadata if name is provided.
export function buildMultiActionConfig(
    steps: ActionPickerSelection[],
    name: string | undefined,
    previousAssignment: ButtonAssignment | null,
    config: RemoteConfig,
    applyAssignment: (config: RemoteConfig, newAssignment: ButtonAssignment) => RemoteConfig
): RemoteConfig {
    const actions = steps.map(selectionToAction);
    const [newSequenceId, configWithId] = consumeId(config, 'sequence');
    const newSequence: Sequence = { id: newSequenceId, actions };

    let updated: RemoteConfig = {
        ...configWithId,
        sequences: [...configWithId.sequences, newSequence],
    };

    if (name) {
        const newMeta: SequenceMetadata = { sequenceId: newSequenceId, name };
        updated = {
            ...updated,
            metadata: {
                ...updated.metadata,
                sequenceMetadata: [...updated.metadata.sequenceMetadata, newMeta],
            },
        };
    }

    const newAssignment: ButtonAssignment = { kind: 'sequence', sequenceId: newSequenceId };
    updated = applyAssignment(updated, newAssignment);

    if (previousAssignment?.kind === 'sequence') {
        updated = garbageCollect(updated);
    }

    return updated;
}
