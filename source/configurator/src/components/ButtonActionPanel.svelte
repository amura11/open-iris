<script lang="ts">
    import type { Device, DeviceFunction } from '@model/devices.ts';
    import type { State, RemoteConfig } from '@model/state.ts';
    import type { ActionPickerSelection, BackToSingleContext } from '@model/configurator-types.ts';
    import { reconstructSteps } from '@model/assignment-utils.ts';
    import SingleActionEditor from './SingleActionEditor.svelte';
    import SequenceActionEditor from './SequenceActionEditor.svelte';

    type ButtonAssignment =
        | { kind: 'sequence'; sequenceId: number }
        | { kind: 'action'; deviceId: number; functionId: number; data: number };

    interface Props {
        devices:           Device[];
        functions:         DeviceFunction[];
        states:            State[];
        remoteConfig:      RemoteConfig;
        currentAssignment: ButtonAssignment | null;
        namedSequences:    Array<{ sequenceId: number; name: string }>;
        onAssignSingle:    (selection: ActionPickerSelection) => void;
        onAssignSequence:  (steps: ActionPickerSelection[], name: string | undefined, delayMs: number) => void;
        onAssignNamed:     (sequenceId: number) => void;
    }

    let { devices, functions, states, remoteConfig, currentAssignment, namedSequences, onAssignSingle, onAssignSequence, onAssignNamed }: Props = $props();

    // ── Initialization helpers ────────────────────────────────────────────────

    function isAssignmentNamed(assignment: ButtonAssignment | null): boolean {
        if (assignment?.kind !== 'sequence') {
            return false;
        }

        return namedSequences.some(s => s.sequenceId === assignment.sequenceId);
    }

    function resolveInitialMode(): 'single' | 'sequence' {
        if (currentAssignment?.kind === 'sequence') {
            if (isAssignmentNamed(currentAssignment)) {
                return 'sequence';
            }

            const seq = remoteConfig.sequences.find(s => s.id === currentAssignment.sequenceId);

            if (seq && seq.actions.length > 1) {
                return 'sequence';
            }
        }

        return 'single';
    }

    function resolveInitialSteps(): ActionPickerSelection[] {
        if (currentAssignment?.kind === 'sequence') {
            const seq = remoteConfig.sequences.find(s => s.id === currentAssignment.sequenceId);

            if (seq) {
                return reconstructSteps(seq, remoteConfig);
            }
        }

        return [];
    }

    function resolveInitialName(): string {
        if (currentAssignment?.kind === 'sequence') {
            const meta = remoteConfig.metadata.sequenceMetadata.find(
                m => m.sequenceId === currentAssignment.sequenceId
            );

            return meta?.name ?? '';
        }

        return '';
    }

    function resolveInitialDelay(): number {
        if (currentAssignment?.kind === 'sequence') {
            const meta = remoteConfig.metadata.sequenceMetadata.find(
                m => m.sequenceId === currentAssignment.sequenceId
            );

            return meta?.delayMs ?? 200;
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
            const meta = remoteConfig.metadata.sequenceMetadata.find(
                m => m.sequenceId === currentAssignment.sequenceId
            );

            return meta?.name !== undefined;
        }

        return false;
    }

    function resolveSelectedKey(): string | undefined {
        if (currentAssignment?.kind === 'action') {
            const { deviceId, functionId } = currentAssignment;
            const device = remoteConfig.devices.find(d => d.id === deviceId);
            const fn     = remoteConfig.functions.find(f => f.id === functionId);

            if (device && fn) {
                return `device:${device.id}:${fn.id}`;
            }

            const SYSTEM_FN_NAVIGATE = 0;
            const SYSTEM_FN_PAUSE    = 1;

            if (functionId === SYSTEM_FN_NAVIGATE) {
                return 'system:navigate';
            }

            if (functionId === SYSTEM_FN_PAUSE) {
                return 'system:pause';
            }

            return 'system:power_off_active';
        }

        if (currentAssignment?.kind === 'sequence') {
            if (isAssignmentNamed(currentAssignment)) {
                return `named:${currentAssignment.sequenceId}`;
            }

            const seq = remoteConfig.sequences.find(s => s.id === currentAssignment.sequenceId);

            if (seq && seq.actions.length === 1) {
                const action = seq.actions[0];
                const device = remoteConfig.devices.find(d => d.id === action.deviceId);
                const fn     = remoteConfig.functions.find(f => f.id === action.functionId);

                if (device && fn) {
                    return `device:${device.id}:${fn.id}`;
                }
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

    function handleSingleSelect(selection: ActionPickerSelection) {
        if (selection.kind === 'device') {
            selectedKey = `device:${selection.device.id}:${selection.deviceFunction.id}`;
        } else {
            selectedKey = `system:${selection.kind}`;
        }

        onAssignSingle(selection);
    }

    function handleSelectNamed(sequenceId: number) {
        const seq  = remoteConfig.sequences.find(s => s.id === sequenceId);
        const meta = remoteConfig.metadata.sequenceMetadata.find(m => m.sequenceId === sequenceId);

        sequenceInitialSteps        = seq ? reconstructSteps(seq, remoteConfig) : [];
        sequenceInitialName         = meta?.name ?? '';
        sequenceInitialDelayMs      = meta?.delayMs ?? 200;
        sequenceInitialIsNamed      = true;
        sequenceInitialNamedId      = sequenceId;
        sequenceInitialHasBeenNamed = meta?.name !== undefined;

        mode = 'sequence';
        onAssignNamed(sequenceId);
    }

    function handleTurnIntoSequence() {
        const firstSteps: ActionPickerSelection[] = [];

        if (currentAssignment?.kind === 'action') {
            const device = remoteConfig.devices.find(d => d.id === currentAssignment.deviceId);
            const fn     = remoteConfig.functions.find(f => f.id === currentAssignment.functionId);

            if (device && fn) {
                firstSteps.push({ kind: 'device', device, deviceFunction: fn });
            }
        } else if (currentAssignment?.kind === 'sequence') {
            const seq = remoteConfig.sequences.find(s => s.id === currentAssignment.sequenceId);

            if (seq) {
                firstSteps.push(...reconstructSteps(seq, remoteConfig));
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
    <SingleActionEditor
        {devices}
        {functions}
        {states}
        {namedSequences}
        {selectedKey}
        onSelect={handleSingleSelect}
        onSelectNamed={handleSelectNamed}
        onTurnIntoSequence={handleTurnIntoSequence}
    />
{:else}
    <SequenceActionEditor
        {devices}
        {functions}
        {states}
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
