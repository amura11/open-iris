<script lang="ts">
    import type { SequenceStep, BackToSingleContext, ButtonAssignment } from '@model/configurator-types.ts';
    import { configuratorStore } from '@stores/configurator-store.svelte.ts';
    import {
        SYSTEM_DEVICE_ID, SYSTEM_FN_NAVIGATE, SYSTEM_FN_PAUSE, SYSTEM_FN_POWER_OFF_ACTIVE,
    } from '@model/serialization.ts';
    import ActionPicker from '@components/action/ActionPicker.svelte';
    import SequenceActionEditor from '@components/action/SequenceActionEditor.svelte';

    interface Props {
        currentAssignment: ButtonAssignment | null;
        onAssignSingle:    (step: SequenceStep) => void;
        onAssignSequence:  (steps: SequenceStep[], name: string | undefined, delayMs: number) => void;
        onAssignNamed:     (sequenceId: number) => void;
    }

    let { currentAssignment, onAssignSingle, onAssignSequence, onAssignNamed }: Props = $props();

    // ── Initialization helpers ────────────────────────────────────────────────

    function isAssignmentNamed(assignment: ButtonAssignment | null): boolean {
        if (assignment?.kind !== 'sequence') {
            return false;
        }

        const sequence = configuratorStore.sequences.find(s => s.id === assignment.sequenceId);
        return sequence?.name !== undefined;
    }

    function resolveInitialMode(): 'single' | 'sequence' {
        if (currentAssignment?.kind === 'sequence') {
            if (isAssignmentNamed(currentAssignment)) {
                return 'sequence';
            }

            const sequence = configuratorStore.sequences.find(s => s.id === currentAssignment.sequenceId);

            if (sequence && sequence.steps.length > 1) {
                return 'sequence';
            }
        }

        return 'single';
    }

    function resolveInitialSteps(): SequenceStep[] {
        if (currentAssignment?.kind === 'sequence') {
            const sequence = configuratorStore.sequences.find(s => s.id === currentAssignment.sequenceId);

            if (sequence) {
                return sequence.steps;
            }
        }

        return [];
    }

    function resolveInitialName(): string {
        if (currentAssignment?.kind === 'sequence') {
            const sequence = configuratorStore.sequences.find(s => s.id === currentAssignment.sequenceId);
            return sequence?.name ?? '';
        }
        return '';
    }

    function resolveInitialDelay(): number {
        if (currentAssignment?.kind === 'sequence') {
            const sequence = configuratorStore.sequences.find(s => s.id === currentAssignment.sequenceId);
            return sequence?.delayMs ?? 200;
        }
        return 200;
    }

    function resolveInitialIsNamed(): boolean {
        return isAssignmentNamed(currentAssignment);
    }

    function resolveInitialNamedId(): number | null {
        if (currentAssignment?.kind === 'sequence' && isAssignmentNamed(currentAssignment)) {
            return currentAssignment.sequenceId;
        }
        return null;
    }

    function resolveInitialHasBeenNamed(): boolean {
        if (currentAssignment?.kind === 'sequence') {
            const sequence = configuratorStore.sequences.find(s => s.id === currentAssignment.sequenceId);
            return sequence?.name !== undefined;
        }
        return false;
    }

    function resolveSelectedKey(): string | undefined {
        if (currentAssignment?.kind === 'action') {
            const { deviceId, functionId } = currentAssignment;

            if (deviceId === SYSTEM_DEVICE_ID) {
                if (functionId === SYSTEM_FN_NAVIGATE) {
                    return 'system:navigate';
                }

                if (functionId === SYSTEM_FN_PAUSE) {
                    return 'system:pause';
                }

                return 'system:power_off_active';
            }

            const device = configuratorStore.devices.find(d => d.id === deviceId);
            const deviceFunction = device?.functions.find(f => f.id === functionId);

            if (device && deviceFunction) {
                return `device:${device.id}:${deviceFunction.id}`;
            }
        }

        if (currentAssignment?.kind === 'sequence') {
            if (isAssignmentNamed(currentAssignment)) {
                return `named:${currentAssignment.sequenceId}`;
            }

            const sequence = configuratorStore.sequences.find(s => s.id === currentAssignment.sequenceId);

            if (sequence && sequence.steps.length === 1) {
                const step = sequence.steps[0];

                if (step.kind === 'device') {
                    return `device:${step.device.id}:${step.deviceFunction.id}`;
                }

                if (step.kind === 'navigate') {
                    return 'system:navigate';
                }

                if (step.kind === 'pause') {
                    return 'system:pause';
                }

                return 'system:power_off_active';
            }
        }

        return undefined;
    }

    // ── Coordinator state ─────────────────────────────────────────────────────

    let mode        = $state<'single' | 'sequence'>(resolveInitialMode());
    let selectedKey = $state<string | undefined>(resolveSelectedKey());

    // Initial values passed to SequenceActionEditor on mount.
    // Updated before each mode switch so the new SequenceActionEditor
    // instance mounts with the correct state.
    let sequenceInitialSteps        = $state(resolveInitialSteps());
    let sequenceInitialName         = $state(resolveInitialName());
    let sequenceInitialDelayMs      = $state(resolveInitialDelay());
    let sequenceInitialIsNamed      = $state(resolveInitialIsNamed());
    let sequenceInitialNamedId      = $state<number | null>(resolveInitialNamedId());
    let sequenceInitialHasBeenNamed = $state(resolveInitialHasBeenNamed());

    $effect(() => {
        if (currentAssignment === null) {
            mode        = 'single';
            selectedKey = undefined;
        }
    });

    // ── Mode transition handlers ──────────────────────────────────────────────

    function handleSingleSelect(step: SequenceStep) {
        if (step.kind === 'device') {
            selectedKey = `device:${step.device.id}:${step.deviceFunction.id}`;
        } else {
            selectedKey = `system:${step.kind}`;
        }
        onAssignSingle(step);
    }

    function handleSelectNamed(sequenceId: number) {
        const sequence = configuratorStore.sequences.find(s => s.id === sequenceId);

        sequenceInitialSteps        = sequence?.steps ?? [];
        sequenceInitialName         = sequence?.name ?? '';
        sequenceInitialDelayMs      = sequence?.delayMs ?? 200;
        sequenceInitialIsNamed      = true;
        sequenceInitialNamedId      = sequenceId;
        sequenceInitialHasBeenNamed = sequence?.name !== undefined;

        mode = 'sequence';
        onAssignNamed(sequenceId);
    }

    function handleTurnIntoSequence() {
        const firstSteps: SequenceStep[] = [];

        if (currentAssignment?.kind === 'action') {
            const { deviceId, functionId, data } = currentAssignment;
            if (deviceId === SYSTEM_DEVICE_ID) {
                if (functionId === SYSTEM_FN_NAVIGATE) {
                    firstSteps.push({ kind: 'navigate', targetStateId: data });
                } else if (functionId === SYSTEM_FN_PAUSE) {
                    firstSteps.push({ kind: 'pause', durationMs: data });
                } else if (functionId === SYSTEM_FN_POWER_OFF_ACTIVE) {
                    firstSteps.push({ kind: 'power_off_active' });
                }
            } else {
                const device = configuratorStore.devices.find(d => d.id === deviceId);
                const deviceFunction = device?.functions.find(f => f.id === functionId);
                if (device && deviceFunction) {
                    firstSteps.push({ kind: 'device', device, deviceFunction });
                }
            }
        } else if (currentAssignment?.kind === 'sequence') {
            const sequence = configuratorStore.sequences.find(s => s.id === currentAssignment.sequenceId);

            if (sequence) {
                firstSteps.push(...sequence.steps);
            }
        }

        sequenceInitialSteps        = firstSteps;
        sequenceInitialName         = '';
        sequenceInitialDelayMs      = 200;
        sequenceInitialIsNamed      = false;
        sequenceInitialNamedId      = null;
        sequenceInitialHasBeenNamed = false;

        mode = 'sequence';

        if (firstSteps.length > 0) {
            onAssignSequence(firstSteps, undefined, 200);
        }
    }

    function handleBackToSingle(context: BackToSingleContext) {
        if (context.kind === 'named') {
            selectedKey = `named:${context.namedSequenceId}`;
        } else if (context.firstStep !== null) {
            const step = context.firstStep;
            if (step.kind === 'device') {
                selectedKey = `device:${step.device.id}:${step.deviceFunction.id}`;
            } else {
                selectedKey = `system:${step.kind}`;
            }
            onAssignSingle(step);
        } else {
            selectedKey = undefined;
        }
        mode = 'single';
    }
</script>

{#if mode === 'single'}
    <div class="flex flex-col">
        <ActionPicker
            mode="single"
            {selectedKey}
            onSelect={handleSingleSelect}
            onSelectNamed={handleSelectNamed}
        />
        <div class="flex items-center border-t border-surface-200-800 mt-2 pt-2">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button class="btn btn-sm hover:preset-tonal" onclick={handleTurnIntoSequence}>
                + Turn into sequence
            </button>
        </div>
    </div>
{:else}
    <SequenceActionEditor
        initialSteps={sequenceInitialSteps}
        initialName={sequenceInitialName}
        initialDelayMs={sequenceInitialDelayMs}
        initialIsNamed={sequenceInitialIsNamed}
        initialNamedId={sequenceInitialNamedId}
        initialHasBeenNamed={sequenceInitialHasBeenNamed}
        {onAssignSequence}
        onBackToSingle={handleBackToSingle}
    />
{/if}
