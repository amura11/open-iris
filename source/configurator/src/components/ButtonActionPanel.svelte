<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/input/input.js';
    import '@shoelace-style/shoelace/dist/components/badge/badge.js';
    import '@shoelace-style/shoelace/dist/components/button/button.js';
    import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
    import '@shoelace-style/shoelace/dist/components/icon/icon.js';
    import '@shoelace-style/shoelace/dist/components/divider/divider.js';
    import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
    import type SlDialog from '@shoelace-style/shoelace/dist/components/dialog/dialog.component.js';
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
    // True while viewing/editing a named sequence with no local modifications.
    // Set to false the moment the user modifies steps (turning it anonymous).
    let isNamedSequence  = $state(resolveInitialIsNamed());
    let namedSequenceId  = $state<number | null>(resolveInitialNamedId());
    let hasBeenNamed     = $state(resolveInitialHasBeenNamed());

    let confirmDialog = $state<SlDialog | null>(null);

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

    // Called after any step modification — clears the named-sequence flag
    // on the first edit and propagates to the parent.
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
            // Named sequence: go back silently, restore its checkmark
            mode = 'single';
            selectedKey = namedSequenceId !== null ? `named:${namedSequenceId}` : undefined;
            return;
        }

        if (stepCount > 1) {
            confirmDialog?.show();
        } else {
            doBackToSingle();
        }
    }

    function doBackToSingle() {
        confirmDialog?.hide();
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
    <div class="d-flex flex-col">
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
        <div class="panel-footer d-flex items-center border-top mt-xs pt-xs">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <sl-button variant="text" size="small" onclick={handleTurnIntoSequence}>
                + Turn into sequence
            </sl-button>
        </div>
    </div>

{:else}
    <!-- ── Sequence mode ──────────────────────────────────────────────────── -->
    <div class="seq-panel d-flex flex-col">

        <!-- Section 1: Settings -->
        <div class="seq-section shrink-0">
            <div class="section-header d-flex items-center justify-between px-xs py-3xs">
                <span class="section-label uppercase tracking-loose text-xs text-muted font-semibold">Sequence settings</span>
                {#if isReusable}
                    <sl-badge variant="success">Reusable</sl-badge>
                {:else if isNamedSequence}
                    <sl-badge variant="neutral">Named</sl-badge>
                {/if}
            </div>
            <div class="settings-body d-flex flex-col gap-xs px-xs py-xs">
                <sl-input
                    size="small"
                    label="Name"
                    placeholder="Name to make reusable…"
                    value={seqName}
                    required={hasBeenNamed || undefined}
                    oninput={(e: Event) => handleNameInput((e.target as HTMLInputElement).value)}
                ></sl-input>
                <sl-input
                    size="small"
                    label="Delay"
                    type="number"
                    value={String(seqDelayMs)}
                    min="0"
                    step="50"
                    oninput={(e: Event) => handleDelayInput((e.target as HTMLInputElement).value)}
                >
                    <span slot="suffix" class="text-xs text-muted">ms between steps</span>
                </sl-input>
            </div>
        </div>

        <sl-divider style="margin: 0;"></sl-divider>

        <!-- Section 2: Search (above the step list) -->
        <div class="seq-section shrink-0">
            <div class="section-header d-flex items-center justify-between px-xs py-3xs">
                <span class="section-label uppercase tracking-loose text-xs text-muted font-semibold">Add actions</span>
            </div>
            <div class="search-body px-xs pb-xs pt-xs">
                <ActionPicker
                    {devices}
                    {functions}
                    {states}
                    mode="sequence"
                    onSelect={handleAddStep}
                />
            </div>
        </div>

        <sl-divider style="margin: 0;"></sl-divider>

        <!-- Section 3: Steps list -->
        <div class="seq-section d-flex flex-col shrink-0">
            <div class="section-header d-flex items-center justify-between px-xs py-3xs">
                <span class="section-label uppercase tracking-loose text-xs text-muted font-semibold">Actions</span>
                <span class="text-xs text-muted">{stepLabel}</span>
            </div>
            <div class="steps-list-wrap">
                {#if stepCount === 0}
                    <p class="text-xs text-muted m-0 px-xs py-xs empty-msg">
                        No steps yet — add actions above.
                    </p>
                {:else}
                    <div class="steps-list px-xs py-xs d-flex flex-col gap-2xs">
                        {#each steps as step, index (index)}
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                                class="seq-row d-flex items-center gap-2xs"
                                class:drag-over={dragOverIndex === index}
                                class:dragging={dragSrcIndex === index}
                                draggable="true"
                                ondragstart={(e) => onDragStart(index, e)}
                                ondragend={onDragEnd}
                                ondragover={(e) => onDragOver(index, e)}
                                ondragleave={() => onDragLeave(index)}
                                ondrop={(e) => onDrop(index, e)}
                            >
                                <sl-icon name="grip-vertical" class="drag-handle text-muted shrink-0"></sl-icon>
                                <span class="seq-num text-xs text-muted shrink-0">{index + 1}</span>
                                <span class="text-s flex-1 min-w-0 truncate">{stepName(step)}</span>
                                <span class="text-xs text-muted shrink-0">{stepDevice(step)}</span>
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <!-- svelte-ignore a11y_no_static_element_interactions -->
                                <sl-icon-button
                                    name="x"
                                    label="Remove step"
                                    class="remove-btn shrink-0"
                                    onclick={() => handleRemoveStep(index)}
                                ></sl-icon-button>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>

        <!-- Footer -->
        <div class="panel-footer d-flex items-center justify-between border-top px-xs py-xs shrink-0">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <sl-button variant="text" size="small" onclick={handleBackToSingle}>
                ✕ Back to single action
            </sl-button>
            <span class="text-xs text-muted">{stepLabel}</span>
        </div>

    </div>

    <!-- Discard confirmation (only for anonymous multi-step sequences) -->
    <sl-dialog
        bind:this={confirmDialog}
        label="Discard sequence?"
        style="--width: 320px;"
    >
        <p class="text-s m-0">
            This will discard {stepCount - 1} step{stepCount - 1 === 1 ? '' : 's'}. Continue?
        </p>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <sl-button slot="footer" variant="text" onclick={() => confirmDialog?.hide()}>Cancel</sl-button>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <sl-button slot="footer" variant="primary" onclick={doBackToSingle}>Discard</sl-button>
    </sl-dialog>
{/if}

<style>
    .panel-footer {
        padding-top: var(--sl-spacing-x-small);
        padding-bottom: var(--sl-spacing-x-small);
    }

    .section-header {
        background: var(--sl-color-neutral-50);
        border-bottom: 1px solid var(--color-border);
    }

    .seq-section {
        border-bottom: 1px solid var(--color-border);
    }

    .seq-section:last-of-type {
        border-bottom: none;
    }

    .steps-list-wrap {
        overflow-y: auto;
        max-height: 10rem;
    }

    .search-body {
        overflow-y: visible;
    }

    .empty-msg {
        font-style: italic;
    }

    .seq-row {
        padding: var(--sl-spacing-2x-small) var(--sl-spacing-x-small);
        border: 1px solid var(--color-border);
        border-radius: var(--sl-border-radius-medium);
        cursor: grab;
        user-select: none;
        background: var(--sl-color-neutral-0);
        transition: opacity 0.1s, border-color 0.1s, background-color 0.1s;
    }

    .seq-row:active {
        cursor: grabbing;
    }

    .seq-row.dragging {
        opacity: 0.35;
    }

    .seq-row.drag-over {
        border-color: var(--color-primary);
        background: var(--sl-color-primary-50);
    }

    .drag-handle {
        cursor: grab;
        font-size: var(--sl-font-size-small);
    }

    .seq-num {
        min-width: 1rem;
        text-align: right;
    }

    .remove-btn {
        font-size: var(--sl-font-size-x-small);
    }
</style>
