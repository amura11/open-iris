<script lang="ts">
    import { untrack } from 'svelte';
    import { GripVerticalIcon, XIcon } from '@lucide/svelte';
    import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
    import type { SequenceStep, BackToSingleContext } from '@model/configurator-types.ts';
    import { configuratorStore } from '@stores/configurator-store.svelte.ts';
    import ActionCombobox from './ActionCombobox.svelte';

    interface Props {
        initialSteps:        SequenceStep[];
        initialName:         string;
        initialDelayMs:      number;
        initialIsNamed:      boolean;
        initialNamedId:      number | null;
        initialHasBeenNamed: boolean;
        onAssignSequence:    (steps: SequenceStep[], name: string | undefined, delayMs: number) => void;
        onBackToSingle:      (context: BackToSingleContext) => void;
    }

    let {
        initialSteps,
        initialName,
        initialDelayMs,
        initialIsNamed,
        initialNamedId,
        initialHasBeenNamed,
        onAssignSequence,
        onBackToSingle,
    }: Props = $props();

    // ── State ─────────────────────────────────────────────────────────────────

    // untrack() captures the prop's value at mount time only — this component
    // owns its state from that point on, independent of the parent's prop.
    let steps        = $state<SequenceStep[]>(untrack(() => initialSteps));
    let seqName      = $state(untrack(() => initialName));
    let seqDelayMs   = $state(untrack(() => initialDelayMs));
    let isNamed      = $state(untrack(() => initialIsNamed));
    let namedId      = $state<number | null>(untrack(() => initialNamedId));
    let hasBeenNamed = $state(untrack(() => initialHasBeenNamed));

    let confirmDialogOpen = $state(false);

    let stepCount = $derived(steps.length);
    let stepLabel = $derived(stepCount === 1 ? '1 step' : `${stepCount} steps`);
    let isReusable = $derived(seqName.trim().length > 0);

    // ── Drag-and-drop ─────────────────────────────────────────────────────────

    let dragSourceIndex = $state<number | null>(null);
    let dragOverIndex   = $state<number | null>(null);

    function handleDragStart(index: number, event: DragEvent) {
        dragSourceIndex = index;

        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
        }
    }

    function handleDragEnd() {
        dragSourceIndex = null;
        dragOverIndex   = null;
    }

    function handleDragOver(index: number, event: DragEvent) {
        event.preventDefault();

        if (dragSourceIndex !== null && index !== dragSourceIndex) {
            dragOverIndex = index;
        }
    }

    function handleDragLeave(index: number) {
        if (dragOverIndex === index) {
            dragOverIndex = null;
        }
    }

    function handleDrop(targetIndex: number, event: DragEvent) {
        event.preventDefault();

        if (dragSourceIndex !== null && dragSourceIndex !== targetIndex) {
            const reordered = [...steps];
            const [moved]   = reordered.splice(dragSourceIndex, 1);
            reordered.splice(targetIndex, 0, moved);
            steps = reordered;
            markModifiedAndNotify();
        }

        dragSourceIndex = null;
        dragOverIndex   = null;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function stepName(step: SequenceStep): string {
        if (step.kind === 'device') {
            return step.deviceFunction.name;
        }

        if (step.kind === 'navigate') {
            const target = configuratorStore.states.find(s => s.id === step.targetStateId);
            return `Navigate → ${target?.name ?? 'Unknown'}`;
        }

        if (step.kind === 'pause') {
            return `Pause ${step.durationMs}ms`;
        }

        return 'Power off active devices';
    }

    function stepDevice(step: SequenceStep): string {
        if (step.kind === 'device') {
            return step.device.name;
        }

        return 'System';
    }

    function markModifiedAndNotify() {
        isNamed = false;
        namedId = null;
        notifySequence();
    }

    function notifySequence() {
        onAssignSequence(steps, seqName.trim() || undefined, seqDelayMs);
    }

    // ── Handlers ──────────────────────────────────────────────────────────────

    function handleAddStep(selection: SequenceStep) {
        steps = [...steps, selection];
        markModifiedAndNotify();
    }

    function handleRemoveStep(index: number) {
        steps = steps.filter((_, stepIndex) => stepIndex !== index);
        markModifiedAndNotify();
    }

    function handleNameInput(event: Event) {
        const value = (event.target as HTMLInputElement).value;
        seqName = value;

        if (value.trim().length > 0) {
            hasBeenNamed = true;
        }

        notifySequence();
    }

    function handleDelayInput(event: Event) {
        const parsed = parseInt((event.target as HTMLInputElement).value, 10);
        seqDelayMs = isNaN(parsed) ? 200 : Math.max(0, parsed);
        notifySequence();
    }

    function handleBackToSingleClick() {
        if (isNamed) {
            onBackToSingle({ kind: 'named', namedSequenceId: namedId! });
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
        const firstStep = steps.length > 0 ? steps[0] : null;
        onBackToSingle({ kind: 'anonymous', firstStep });
    }
</script>

<div class="seq-panel flex flex-col flex-1 min-h-0">

    <!-- Section 1: Settings -->
    <div class="seq-section shrink-0">
        <div class="section-header flex items-center justify-between px-2 py-1">
            <span class="uppercase tracking-wide text-xs text-surface-500-400 font-semibold">Sequence settings</span>
            {#if isReusable}
                <span class="badge preset-filled-success-500 rounded-full">Reusable</span>
            {:else if isNamed}
                <span class="badge preset-tonal rounded-full">Named</span>
            {/if}
        </div>
        <div class="flex flex-col gap-2 px-2 py-2">
            <label class="label">
                <span class="label-text">Name</span>
                <input
                    class="input text-sm py-1.5"
                    placeholder="Name to make reusable…"
                    value={seqName}
                    required={hasBeenNamed || undefined}
                    oninput={handleNameInput}
                />
            </label>
            <label class="label">
                <span class="label-text">Delay</span>
                <input
                    class="input text-sm py-1.5"
                    type="number"
                    value={String(seqDelayMs)}
                    min="0"
                    step="50"
                    oninput={handleDelayInput}
                />
                <span class="field-hint">Milliseconds between each step</span>
            </label>
        </div>
    </div>

    <hr class="hr m-0" />

    <!-- Section 2: Actions with inline search -->
    <div class="seq-section flex-1 min-h-0 flex flex-col">
        <div class="section-header shrink-0 flex flex-col gap-2 px-2 py-2">
            <div class="flex items-center justify-between">
                <span class="uppercase tracking-wide text-xs text-surface-500-400 font-semibold">Actions</span>
                <span class="text-xs text-surface-500-400">{stepLabel}</span>
            </div>
            <ActionCombobox onSelect={handleAddStep} />
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
                            class:dragging={dragSourceIndex === index}
                            draggable="true"
                            ondragstart={(event) => handleDragStart(index, event)}
                            ondragend={handleDragEnd}
                            ondragover={(event) => handleDragOver(index, event)}
                            ondragleave={() => handleDragLeave(index)}
                            ondrop={(event) => handleDrop(index, event)}
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
    <div class="flex items-center border-t border-surface-200-800 px-2 py-2 shrink-0">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <button class="btn btn-sm hover:preset-tonal" onclick={handleBackToSingleClick}>
            ✕ Back to single action
        </button>
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

<style>
    .field-hint {
        font-size: 0.75rem;
        color: light-dark(var(--color-surface-500), var(--color-surface-400));
    }

    .section-header {
        background: light-dark(var(--color-surface-100), var(--color-surface-800));
        border-bottom: 1px solid light-dark(var(--color-surface-200), var(--color-surface-700));
    }

    .seq-section {
        border-bottom: 1px solid light-dark(var(--color-surface-200), var(--color-surface-700));
    }

    .seq-section:last-of-type { border-bottom: none; }

    .steps-list-wrap {
        flex: 1 1 0;
        min-height: 0;
        overflow-y: auto;
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
