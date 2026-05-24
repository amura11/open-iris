import type { ButtonDescriptor } from '@layout/layout-types.ts';
import type { ScreenButton, ButtonAssignment, SequenceStep, State, PhysicalButton, SequenceEditorConfirmation } from '@model/configurator-types.ts';
import { stepToWireAction, configuratorStore } from '@stores/configurator-store.svelte.ts';

// ── Physical button helpers ───────────────────────────────────────────────────

function withPhysicalButton(state: State, buttonCode: string, assignment: ButtonAssignment): PhysicalButton[] {
    const hasExisting = state.physicalButtons.some((b) => b.buttonCode === buttonCode);
    const newEntry: PhysicalButton = { buttonCode: buttonCode as PhysicalButton['buttonCode'], assignment };

    if (hasExisting) {
        return state.physicalButtons.map((b) => (b.buttonCode === buttonCode ? newEntry : b));
    }

    return [...state.physicalButtons, newEntry];
}

function stepToAssignment(step: SequenceStep): ButtonAssignment {
    const wireAction = stepToWireAction(step);

    return {
        kind: 'action',
        deviceId: wireAction.deviceId,
        functionId: wireAction.functionId,
        data: wireAction.data,
    };
}

// ── Physical button public API ────────────────────────────────────────────────

export function assignPhysicalButtonSingleAction(button: ButtonDescriptor, step: SequenceStep): void {
    const activeState = configuratorStore.selectedState;
    const previousAssignment = activeState.physicalButtons.find((b) => b.buttonCode === button.buttonCode)?.assignment ?? null;

    const updatedPhysicalButtons = withPhysicalButton(activeState, button.buttonCode, stepToAssignment(step));
    configuratorStore.updateState({ ...activeState, physicalButtons: updatedPhysicalButtons });

    if (previousAssignment?.kind === 'sequence') {
        configuratorStore.deleteAnonymousSequence(previousAssignment.sequenceId);
    }
}

export function assignPhysicalButtonSequence(button: ButtonDescriptor, steps: SequenceStep[], name: string | undefined, delayMs: number): void {
    if (steps.length === 0) {
        return;
    }

    const activeState = configuratorStore.selectedState;
    const previousAssignment = activeState.physicalButtons.find((b) => b.buttonCode === button.buttonCode)?.assignment ?? null;

    let sequenceId: number;

    if (previousAssignment?.kind === 'sequence') {
        configuratorStore.updateSequence(previousAssignment.sequenceId, steps, name, delayMs);
        sequenceId = previousAssignment.sequenceId;
    } else {
        sequenceId = configuratorStore.addSequence(steps, name, delayMs);
    }

    const updatedPhysicalButtons = withPhysicalButton(activeState, button.buttonCode, { kind: 'sequence', sequenceId });
    configuratorStore.updateState({ ...activeState, physicalButtons: updatedPhysicalButtons });
}

export function assignPhysicalButtonNamedSequence(button: ButtonDescriptor, sequenceId: number): void {
    const activeState = configuratorStore.selectedState;
    const previousAssignment = activeState.physicalButtons.find((b) => b.buttonCode === button.buttonCode)?.assignment ?? null;

    const updatedPhysicalButtons = withPhysicalButton(activeState, button.buttonCode, { kind: 'sequence', sequenceId });
    configuratorStore.updateState({ ...activeState, physicalButtons: updatedPhysicalButtons });

    if (previousAssignment?.kind === 'sequence' && previousAssignment.sequenceId !== sequenceId) {
        configuratorStore.deleteAnonymousSequence(previousAssignment.sequenceId);
    }
}

export function removePhysicalButtonAssignment(button: ButtonDescriptor): void {
    const activeState = configuratorStore.selectedState;
    const previousAssignment = activeState.physicalButtons.find((b) => b.buttonCode === button.buttonCode)?.assignment ?? null;

    const updatedPhysicalButtons = activeState.physicalButtons.filter((b) => b.buttonCode !== button.buttonCode);
    configuratorStore.updateState({ ...activeState, physicalButtons: updatedPhysicalButtons });

    if (previousAssignment?.kind === 'sequence') {
        configuratorStore.deleteAnonymousSequence(previousAssignment.sequenceId);
    }
}

// ── Screen button public API ──────────────────────────────────────────────────

export function assignScreenButtonSingleAction(screenButton: ScreenButton, step: SequenceStep): void {
    const activeState = configuratorStore.selectedState;
    const previousAssignment = screenButton.assignment;

    const updatedScreenButtons = activeState.screenButtons.map((b) => (b.id === screenButton.id ? { ...b, assignment: stepToAssignment(step) } : b));
    configuratorStore.updateState({ ...activeState, screenButtons: updatedScreenButtons });

    if (previousAssignment?.kind === 'sequence') {
        configuratorStore.deleteAnonymousSequence(previousAssignment.sequenceId);
    }
}

export function assignScreenButtonSequence(screenButton: ScreenButton, result: SequenceEditorConfirmation): void {
    const activeState = configuratorStore.selectedState;
    const previousAssignment = screenButton.assignment;

    let sequenceId: number;

    if (previousAssignment?.kind === 'sequence') {
        configuratorStore.updateSequence(previousAssignment.sequenceId, result.steps, result.name, result.delayMs);
        sequenceId = previousAssignment.sequenceId;
    } else {
        sequenceId = configuratorStore.addSequence(result.steps, result.name, result.delayMs);
    }

    const updatedScreenButtons = activeState.screenButtons.map((b) => (b.id === screenButton.id ? { ...b, assignment: { kind: 'sequence' as const, sequenceId } } : b));
    configuratorStore.updateState({ ...activeState, screenButtons: updatedScreenButtons });
}

export function assignScreenButtonNamedSequence(screenButton: ScreenButton, sequenceId: number): void {
    const activeState = configuratorStore.selectedState;
    const previousAssignment = screenButton.assignment;

    const updatedScreenButtons = activeState.screenButtons.map((b) => (b.id === screenButton.id ? { ...b, assignment: { kind: 'sequence' as const, sequenceId } } : b));
    configuratorStore.updateState({ ...activeState, screenButtons: updatedScreenButtons });

    if (previousAssignment?.kind === 'sequence' && previousAssignment.sequenceId !== sequenceId) {
        configuratorStore.deleteAnonymousSequence(previousAssignment.sequenceId);
    }
}

export function removeScreenButtonAssignment(screenButton: ScreenButton): void {
    const activeState = configuratorStore.selectedState;
    const previousAssignment = screenButton.assignment;

    const updatedScreenButtons = activeState.screenButtons.map((b) => (b.id === screenButton.id ? { ...b, assignment: null } : b));
    configuratorStore.updateState({ ...activeState, screenButtons: updatedScreenButtons });

    if (previousAssignment?.kind === 'sequence') {
        configuratorStore.deleteAnonymousSequence(previousAssignment.sequenceId);
    }
}
