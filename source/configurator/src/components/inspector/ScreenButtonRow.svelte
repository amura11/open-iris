<script lang="ts">
    import { PencilIcon, Trash2Icon, ListVideoIcon, ZapIcon, ArrowRightIcon, ListIcon } from '@lucide/svelte';
    import type { ScreenButton, SequenceStep, SequenceEditorConfirmation } from '@model/configurator-types.ts';
    import { assignmentLabel } from '@utils/label-utils.ts';
    import { configStore } from '@stores/config-store.svelte.ts';
    import {
        assignScreenButtonSingleAction,
        assignScreenButtonSequence,
        assignScreenButtonNamedSequence,
        removeScreenButtonAssignment,
    } from '@services/assignment-service.ts';
    import ActionPicker from '@components/action/ActionPicker.svelte';
    import SequenceEditorDialog from '@components/dialogs/SequenceEditorDialog.svelte';

    interface Props {
        button:   ScreenButton;
        onRename: (updated: ScreenButton) => void;
        onDelete: () => void;
    }

    let { button, onRename, onDelete }: Props = $props();

    let isRenamingLabel           = $state(false);
    let pendingLabel               = $state('');
    let isAssigning                = $state(false);
    let isChangingAssignment       = $state(false);
    let sequenceEditorOpen         = $state(false);
    let sequenceEditorInitialSteps = $state<SequenceStep[]>([]);
    let sequenceEditorInitialName  = $state<string | undefined>(undefined);

    let currentAssignment = $derived(button.assignment ?? null);
    let isAssigned        = $derived(currentAssignment !== null);

    let currentSequence = $derived(
        currentAssignment?.kind === 'sequence'
            ? configStore.sequences.find(s => s.id === currentAssignment.sequenceId) ?? null
            : null
    );

    let isNamed = $derived(
        currentAssignment?.kind === 'sequence' && currentSequence?.name !== undefined
    );

    let showPicker          = $derived(!isAssigned || isChangingAssignment);
    let showAssignmentPanel = $derived(isAssigning || isChangingAssignment);

    let namedSequences = $derived(
        configStore.sequences.filter(s => s.name !== undefined)
    );

    function startRename() {
        pendingLabel = button.label;
        isRenamingLabel = true;
    }

    function commitRename() {
        if (pendingLabel.trim()) {
            onRename({ ...button, label: pendingLabel.trim() });
        }
        isRenamingLabel = false;
    }

    function handleRenameKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') commitRename();
        if (event.key === 'Escape') isRenamingLabel = false;
    }

    function handleSingleAction(selection: SequenceStep) {
        assignScreenButtonSingleAction(button, selection);
        isChangingAssignment = false;
        isAssigning = false;
    }

    function handleSequenceEditorConfirm(result: SequenceEditorConfirmation) {
        assignScreenButtonSequence(button, result);
        isChangingAssignment = false;
        isAssigning = false;
        sequenceEditorOpen = false;
    }

    function handleAssignNamedSequence(sequenceId: number) {
        assignScreenButtonNamedSequence(button, sequenceId);
        isChangingAssignment = false;
        isAssigning = false;
    }

    function handleRemoveAssignment() {
        removeScreenButtonAssignment(button);
        isAssigning = false;
    }

    function openSequenceEditor() {
        sequenceEditorInitialSteps = [];
        sequenceEditorInitialName = undefined;
        sequenceEditorOpen = true;
    }

    function openNamedSequenceEditor() {
        if (!currentSequence) return;
        sequenceEditorInitialSteps = currentSequence.steps;
        sequenceEditorInitialName = currentSequence.name;
        sequenceEditorOpen = true;
    }
</script>

<div class="row-wrapper flex flex-col rounded-md" class:expanded={showAssignmentPanel}>

    <!-- ── Summary row ────────────────────────────────────────── -->
    <div class="item-row flex items-center gap-2">
        {#if isRenamingLabel}
            <!-- svelte-ignore a11y_autofocus -->
            <input
                class="input flex-1"
                bind:value={pendingLabel}
                onkeydown={handleRenameKeydown}
                autofocus
            />
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button class="btn btn-sm preset-filled-primary-500" onclick={commitRename}>Save</button>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button class="btn btn-sm hover:preset-tonal" onclick={() => { isRenamingLabel = false; }}>Cancel</button>
        {:else}
            <div class="flex flex-col flex-1 min-w-0 gap-1">
                <span class="truncate text-sm">{button.label}</span>

                {#if isAssigned && currentAssignment}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <span
                        class="assignment-chip text-xs cursor-pointer truncate"
                        onclick={() => { isAssigning = !isAssigning; isChangingAssignment = false; }}
                    >
                        {assignmentLabel(currentAssignment, configStore.devices, configStore.sequences, configStore.states)}
                    </span>
                {:else}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <span
                        class="unassigned-chip text-xs cursor-pointer"
                        onclick={() => { isAssigning = !isAssigning; isChangingAssignment = false; }}
                    >
                        Assign…
                    </span>
                {/if}
            </div>

            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button class="btn-icon hover:preset-tonal" title="Rename button" onclick={startRename}>
                <PencilIcon class="size-4" />
            </button>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button class="btn-icon hover:preset-tonal text-error-500" title="Delete button" onclick={onDelete}>
                <Trash2Icon class="size-4" />
            </button>
        {/if}
    </div>

    <!-- ── Assignment panel (expands below row) ──────────────────────── -->
    {#if showAssignmentPanel}
        <div class="assignment-panel flex flex-col gap-3 p-3 border-t border-surface-200-800">
            {#if showPicker}
                <ActionPicker onSelect={handleSingleAction} />

                <hr class="hr m-0" />

                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <button class="btn btn-sm hover:preset-tonal" onclick={openSequenceEditor}>
                    <ListIcon class="size-4" />
                    Multi-action sequence…
                </button>

                {#if namedSequences.length > 0}
                    <div>
                        <div class="text-xs text-surface-500-400 uppercase tracking-wider mb-2">Saved sequences</div>
                        <div class="flex flex-col gap-1">
                            {#each namedSequences as sequence (sequence.id)}
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <!-- svelte-ignore a11y_no_static_element_interactions -->
                                <div
                                    class="saved-sequence-row flex items-center justify-between px-2 py-1 rounded cursor-pointer"
                                    onclick={() => handleAssignNamedSequence(sequence.id)}
                                >
                                    <span class="text-sm">{sequence.name}</span>
                                    <ArrowRightIcon class="size-4 text-surface-500-400" />
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <button class="btn btn-sm hover:preset-tonal" onclick={() => { isAssigning = false; isChangingAssignment = false; }}>
                    Cancel
                </button>

            {:else if currentAssignment}
                <div class="flex flex-col gap-3">
                    <div class="assignment-label flex items-center gap-2 px-3 py-2 rounded-md">
                        {#if isNamed}
                            <ListVideoIcon class="size-4 text-surface-500-400 shrink-0" />
                        {:else}
                            <ZapIcon class="size-4 text-surface-500-400 shrink-0" />
                        {/if}
                        <span class="text-sm flex-1 min-w-0 truncate">{assignmentLabel(currentAssignment, configStore.devices, configStore.sequences, configStore.states)}</span>
                    </div>

                    <div class="flex gap-2">
                        {#if isNamed}
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <button class="btn btn-sm hover:preset-tonal" onclick={openNamedSequenceEditor}>Edit sequence</button>
                        {/if}
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <button class="btn btn-sm hover:preset-tonal" onclick={() => { isChangingAssignment = true; }}>Replace</button>
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <button class="btn-icon hover:preset-tonal text-error-500" title="Remove assignment" onclick={handleRemoveAssignment}>
                            <Trash2Icon class="size-4" />
                        </button>
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <button class="btn btn-sm hover:preset-tonal ml-auto" onclick={() => { isAssigning = false; }}>Done</button>
                    </div>
                </div>
            {/if}
        </div>
    {/if}
</div>

<SequenceEditorDialog
    open={sequenceEditorOpen}
    initialSteps={sequenceEditorInitialSteps}
    initialName={sequenceEditorInitialName}
    onConfirm={handleSequenceEditorConfirm}
    onCancel={() => { sequenceEditorOpen = false; }}
/>

<style>
    .row-wrapper {
        border: 1px solid transparent;
        transition: border-color 0.1s, background-color 0.1s;
    }

    .row-wrapper:not(.expanded):hover {
        background-color: color-mix(in srgb, var(--color-primary-500) 6%, transparent);
        border-color: light-dark(var(--color-surface-200), var(--color-surface-700));
    }

    .row-wrapper.expanded {
        border-color: light-dark(var(--color-surface-200), var(--color-surface-700));
    }

    .item-row {
        padding: 0.25rem 0.5rem;
    }

    .assignment-chip {
        color: var(--color-primary-600);
        border-bottom: 1px dashed var(--color-primary-600);
        opacity: 0.8;
    }

    .assignment-chip:hover { opacity: 1; }

    .unassigned-chip {
        color: light-dark(var(--color-surface-600), var(--color-surface-400));
        border-bottom: 1px dashed light-dark(var(--color-surface-600), var(--color-surface-400));
    }

    .unassigned-chip:hover {
        color: light-dark(var(--color-surface-900), var(--color-surface-100));
    }

    .assignment-label {
        background: light-dark(var(--color-surface-100), var(--color-surface-800));
        border: 1px solid light-dark(var(--color-surface-200), var(--color-surface-700));
    }

    .saved-sequence-row {
        border: 1px solid light-dark(var(--color-surface-200), var(--color-surface-700));
        transition: background-color 0.1s;
    }

    .saved-sequence-row:hover {
        background: light-dark(var(--color-surface-100), var(--color-surface-800));
    }
</style>
