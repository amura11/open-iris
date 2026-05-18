<script lang="ts">
    import { GripVerticalIcon, XIcon } from '@lucide/svelte';
    import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
    import type { Device, DeviceFunction } from '@model/devices.ts';
    import type { State, RemoteConfig } from '@model/state.ts';
    import type { ActionPickerSelection } from '@model/configurator-types.ts';
    import { reconstructSteps } from '@model/assignment-utils.ts';
    import ActionPicker from './ActionPicker.svelte';

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

    // ── Initial state resolution ──────────────────────────────────────────────

    function isAssignmentNamed(assignment: ButtonAssignment | null): boolean {
        if (assignment?.kind !== 'sequence') return false;
        return namedSequences.some(s => s.sequenceId === assignment.sequenceId);
    }

    function resolveInitialMode(): 'single' | 'sequence' {
        if (currentAssignment?.kind === 'sequence') {
            if (isAssignmentNamed(currentAssignment)) return 'sequence';
            const seq = remoteConfig.sequences.find(s => s.id === currentAssignment.sequenceId);
            if (seq && seq.actions.length > 1) return 'sequence';
        }
        return 'single';
    }

    function resolveInitialSteps(): ActionPickerSelection[] {
        if (currentAssignment?.kind === 'sequence') {
            const seq = remoteConfig.sequences.find(s => s.id === currentAssignment.sequenceId);
            if (seq) return reconstructSteps(seq, remoteConfig);
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

    function resolveInitialHasBeenNamed(): boolean {
        if (currentAssignment?.kind === 'sequence') {
            const meta = remoteConfig.metadata.sequenceMetadata.find(
                m => m.sequenceId === currentAssignment.sequenceId
            );
            return meta?.name !== undefined;
        }
        return false;
    }

    function resolveInitialNamedId(): number | null {
        if (currentAssignment?.kind === 'sequence' && isAssignmentNamed(currentAssignment)) {
            return currentAssignment.sequenceId;
        }
        return null;
    }

    function resolveSelectedKey(): string | undefined {
        if (currentAssignment?.kind === 'action') {
            const { deviceId, functionId } = currentAssignment;
            const device = remoteConfig.devices.find(d => d.id === deviceId);
            const fn = remoteConfig.functions.find(f => f.id === functionId);
            if (device && fn) return `device:${device.id}:${fn.id}`;
            const SYSTEM_FN_NAVIGATE = 0;
            const SYSTEM_FN_PAUSE    = 1;
            if (functionId === SYSTEM_FN_NAVIGATE) return 'system:navigate';
            if (functionId === SYSTEM_FN_PAUSE)    return 'system:pause';
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
                const fn = remoteConfig.functions.find(f => f.id === action.functionId);
                if (device && fn) return `device:${device.id}:${fn.id}`;
            }
        }
        return undefined;
    }

    // ── State ─────────────────────────────────────────────────────────────────

    let mode             = $state<'single' | 'sequence'>(resolveInitialMode());
    let selectedKey      = $state<string | undefined>(resolveSelectedKey());
    let steps            = $state<ActionPickerSelection[]>(resolveInitialSteps());
    let seqName          = $state(resolveInitialName());
    let seqDelayMs       = $state(resolveInitialDelay());
    let isNamedSequence  = $state(resolveInitialIsNamed());
    let namedSequenceId  = $state<number | null>(resolveInitialNamedId());
    let hasBeenNamed     = $state(resolveInitialHasBeenNamed());

    let confirmDialogOpen = $state(false);

    let stepCount  = $derived(steps.length);
    let stepLabel  = $derived(stepCount === 1 ? '1 step' : `${stepCount} steps`);
    let isReusable = $derived(seqName.trim().length > 0);

    // ── Drag-and-drop ─────────────────────────────────────────────────────────

    let dragSrcIndex  = $state<number | null>(null);
    let dragOverIndex = $state<number | null>(null);

    function onDragStart(index: number, e: DragEvent) {
        dragSrcIndex = index;
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    }

    function onDragEnd() {
        dragSrcIndex = null;
        dragOverIndex = null;
    }

    function onDragOver(index: number, e: DragEvent) {
        e.preventDefault();
        if (dragSrcIndex !== null && index !== dragSrcIndex) {
            dragOverIndex = index;
        }
    }

    function onDragLeave(index: number) {
        if (dragOverIndex === index) dragOverIndex = null;
    }

    function onDrop(targetIndex: number, e: DragEvent) {
        e.preventDefault();
        if (dragSrcIndex !== null && dragSrcIndex !== targetIndex) {
            const updated = [...steps];
            const [moved] = updated.splice(dragSrcIndex, 1);
            updated.splice(targetIndex, 0, moved);
            steps = updated;
            markModifiedAndNotify();
        }
        dragSrcIndex = null;
        dragOverIndex = null;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function stepName(step: ActionPickerSelection): string {
        if (step.kind === 'device') return step.deviceFunction.name;
        if (step.kind === 'navigate') {
            const target = states.find(s => s.id === step.targetStateId);
            return `Navigate → ${target?.name ?? 'Unknown'}`;
        }
        if (step.kind === 'pause') return `Pause ${step.durationMs}ms`;
        return 'Power off active devices';
    }

    function stepDevice(step: ActionPickerSelection): string {
        if (step.kind === 'device') return step.device.name;
        return 'System';
    }

    function markModifiedAndNotify() {
        isNamedSequence = false;
        namedSequenceId = null;
        notifySequence();
    }

    function notifySequence() {
        onAssignSequence(steps, seqName.trim() || undefined, seqDelayMs);
    }

    // ── Assignment handlers ───────────────────────────────────────────────────

    function handleSingleSelect(selection: ActionPickerSelection) {
        if (selection.kind === 'device') {
            selectedKey = `device:${selection.device.id}:${selection.deviceFunction.id}`;
        } else {
            selectedKey = `system:${selection.kind}`;
        }
        onAssignSingle(selection);
    }

    function handleSelectNamed(sequenceId: number) {
        const seq = remoteConfig.sequences.find(s => s.id === sequenceId);
        steps = seq ? reconstructSteps(seq, remoteConfig) : [];
        const meta = remoteConfig.metadata.sequenceMetadata.find(m => m.sequenceId === sequenceId);
        seqName = meta?.name ?? '';
        seqDelayMs = meta?.delayMs ?? 200;
        isNamedSequence = true;
        namedSequenceId = sequenceId;
        mode = 'sequence';
        onAssignNamed(sequenceId);
    }

    function handleTurnIntoSequence() {
        const firstSteps: ActionPickerSelection[] = [];

        if (currentAssignment?.kind === 'action') {
            const device = remoteConfig.devices.find(d => d.id === currentAssignment.deviceId);
            const fn = remoteConfig.functions.find(f => f.id === currentAssignment.functionId);
            if (device && fn) firstSteps.push({ kind: 'device', device, deviceFunction: fn });
        } else if (currentAssignment?.kind === 'sequence') {
            const seq = remoteConfig.sequences.find(s => s.id === currentAssignment.sequenceId);
            if (seq) firstSteps.push(...reconstructSteps(seq, remoteConfig));
        }

        steps = firstSteps;
        seqName = '';
        seqDelayMs = 200;
        isNamedSequence = false;
        namedSequenceId = null;
        mode = 'sequence';

        if (firstSteps.length > 0) notifySequence();
    }

    function handleAddStep(selection: ActionPickerSelection) {
        steps = [...steps, selection];
        markModifiedAndNotify();
    }

    function handleRemoveStep(index: number) {
        steps = steps.filter((_, i) => i !== index);
        markModifiedAndNotify();
    }

    function handleNameInput(value: string) {
        seqName = value;
        if (value.trim().length > 0) hasBeenNamed = true;
        notifySequence();
    }

    function handleDelayInput(value: string) {
        const n = parseInt(value, 10);
        seqDelayMs = isNaN(n) ? 200 : Math.max(0, n);
        notifySequence();
    }

    function handleBackToSingle() {
        if (isNamedSequence) {
            mode = 'single';
            selectedKey = namedSequenceId !== null ? `named:${namedSequenceId}` : undefined;
            return;
        }

        if (stepCount > 1) {
            confirmDialogOpen = true;
        } else {
            doBackToSingle();
        }
    }

    function doBackToSingle() {
        confirmDialogOpen = false;
        if (steps.length > 0) {
            const firstStep = steps[0];
            steps = [];
            mode = 'single';
            if (firstStep.kind === 'device') {
                selectedKey = `device:${firstStep.device.id}:${firstStep.deviceFunction.id}`;
            } else {
                selectedKey = `system:${firstStep.kind}`;
            }
            onAssignSingle(firstStep);
        } else {
            steps = [];
            mode = 'single';
            selectedKey = undefined;
        }
    }
</script>

{#if mode === 'single'}
    <!-- ── Single action mode ─────────────────────────────────────────────── -->
    <div class="flex flex-col">
        <ActionPicker
            {devices}
            {functions}
            {states}
            mode="single"
            {selectedKey}
            {namedSequences}
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
    <!-- ── Sequence mode ──────────────────────────────────────────────────── -->
    <div class="seq-panel flex flex-col">

        <!-- Section 1: Settings -->
        <div class="seq-section shrink-0">
            <div class="section-header flex items-center justify-between px-2 py-1">
                <span class="uppercase tracking-wide text-xs text-surface-500-400 font-semibold">Sequence settings</span>
                {#if isReusable}
                    <span class="badge preset-filled-success-500 rounded-full">Reusable</span>
                {:else if isNamedSequence}
                    <span class="badge preset-tonal rounded-full">Named</span>
                {/if}
            </div>
            <div class="flex flex-col gap-2 px-2 py-2">
                <label class="label">
                    <span class="label-text">Name</span>
                    <input
                        class="input"
                        placeholder="Name to make reusable…"
                        value={seqName}
                        required={hasBeenNamed || undefined}
                        oninput={(e: Event) => handleNameInput((e.target as HTMLInputElement).value)}
                    />
                </label>
                <label class="label">
                    <span class="label-text">Delay</span>
                    <div class="input-group">
                        <input
                            class="ig-input"
                            type="number"
                            value={String(seqDelayMs)}
                            min="0"
                            step="50"
                            oninput={(e: Event) => handleDelayInput((e.target as HTMLInputElement).value)}
                        />
                        <div class="ig-cell text-xs text-surface-500-400">ms between steps</div>
                    </div>
                </label>
            </div>
        </div>

        <hr class="hr m-0" />

        <!-- Section 2: Search (above the step list) -->
        <div class="seq-section shrink-0">
            <div class="section-header flex items-center justify-between px-2 py-1">
                <span class="uppercase tracking-wide text-xs text-surface-500-400 font-semibold">Add actions</span>
            </div>
            <div class="px-2 pb-2 pt-2">
                <ActionPicker
                    {devices}
                    {functions}
                    {states}
                    mode="sequence"
                    onSelect={handleAddStep}
                />
            </div>
        </div>

        <hr class="hr m-0" />

        <!-- Section 3: Steps list -->
        <div class="seq-section flex flex-col shrink-0">
            <div class="section-header flex items-center justify-between px-2 py-1">
                <span class="uppercase tracking-wide text-xs text-surface-500-400 font-semibold">Actions</span>
                <span class="text-xs text-surface-500-400">{stepLabel}</span>
            </div>
            <div class="steps-list-wrap">
                {#if stepCount === 0}
                    <p class="text-xs text-surface-500-400 m-0 px-2 py-2 italic">
                        No steps yet — add actions above.
                    </p>
                {:else}
                    <div class="px-2 py-2 flex flex-col gap-1">
                        {#each steps as step, index (index)}
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                                class="seq-row flex items-center gap-1"
                                class:drag-over={dragOverIndex === index}
                                class:dragging={dragSrcIndex === index}
                                draggable="true"
                                ondragstart={(e) => onDragStart(index, e)}
                                ondragend={onDragEnd}
                                ondragover={(e) => onDragOver(index, e)}
                                ondragleave={() => onDragLeave(index)}
                                ondrop={(e) => onDrop(index, e)}
                            >
                                <GripVerticalIcon class="size-4 text-surface-500-400 shrink-0" style="cursor: grab;" />
                                <span class="seq-num text-xs text-surface-500-400 shrink-0">{index + 1}</span>
                                <span class="text-sm flex-1 min-w-0 truncate">{stepName(step)}</span>
                                <span class="text-xs text-surface-500-400 shrink-0">{stepDevice(step)}</span>
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <!-- svelte-ignore a11y_no_static_element_interactions -->
                                <button
                                    class="btn-icon hover:preset-tonal shrink-0"
                                    title="Remove step"
                                    onclick={() => handleRemoveStep(index)}
                                >
                                    <XIcon class="size-3" />
                                </button>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between border-t border-surface-200-800 px-2 py-2 shrink-0">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button class="btn btn-sm hover:preset-tonal" onclick={handleBackToSingle}>
                ✕ Back to single action
            </button>
            <span class="text-xs text-surface-500-400">{stepLabel}</span>
        </div>

    </div>

    <!-- Discard confirmation (only for anonymous multi-step sequences) -->
    <Dialog
        open={confirmDialogOpen}
        onOpenChange={(details) => { confirmDialogOpen = details.open; }}
    >
        <Portal>
            <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
            <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
                <Dialog.Content class="card bg-surface-100-900 w-80 p-4 space-y-4 shadow-xl">
                    <Dialog.Title class="text-base font-semibold">Discard sequence?</Dialog.Title>
                    <p class="text-sm m-0">
                        This will discard {stepCount - 1} step{stepCount - 1 === 1 ? '' : 's'}. Continue?
                    </p>
                    <footer class="flex justify-end gap-2">
                        <Dialog.CloseTrigger class="btn btn-sm hover:preset-tonal">Cancel</Dialog.CloseTrigger>
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <button class="btn btn-sm preset-filled-primary-500" onclick={doBackToSingle}>Discard</button>
                    </footer>
                </Dialog.Content>
            </Dialog.Positioner>
        </Portal>
    </Dialog>
{/if}

<style>
    .section-header {
        background: light-dark(var(--color-surface-100), var(--color-surface-800));
        border-bottom: 1px solid light-dark(var(--color-surface-200), var(--color-surface-700));
    }

    .seq-section {
        border-bottom: 1px solid light-dark(var(--color-surface-200), var(--color-surface-700));
    }

    .seq-section:last-of-type { border-bottom: none; }

    .steps-list-wrap {
        overflow-y: auto;
        max-height: 10rem;
    }

    .seq-row {
        padding: 0.25rem 0.5rem;
        border: 1px solid light-dark(var(--color-surface-200), var(--color-surface-700));
        border-radius: var(--radius-base);
        cursor: grab;
        user-select: none;
        background: light-dark(var(--color-surface-50), var(--color-surface-900));
        transition: opacity 0.1s, border-color 0.1s, background-color 0.1s;
    }

    .seq-row:active { cursor: grabbing; }

    .seq-row.dragging { opacity: 0.35; }

    .seq-row.drag-over {
        border-color: var(--color-primary-600);
        background: light-dark(var(--color-primary-50), var(--color-primary-950));
    }

    .seq-num {
        min-width: 1rem;
        text-align: right;
    }
</style>
