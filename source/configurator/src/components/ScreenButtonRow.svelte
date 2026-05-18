<script lang="ts">
    import { PencilIcon, Trash2Icon, ListVideoIcon, ZapIcon, ArrowRightIcon, TriangleAlertIcon, ListIcon } from '@lucide/svelte';
    import type { ScreenButtonConfig, Sequence, SequenceId } from '@model/actions.ts';
    import type { State, RemoteConfig, SequenceMetadata } from '@model/state.ts';
    import type { ActionPickerSelection, SequenceEditorConfirmation } from '@model/configurator-types.ts';
    import {
        garbageCollect,
        assignmentLabel,
        reconstructSteps,
        findButtonsUsingSequence,
        buildSingleActionConfig,
        buildMultiActionConfig,
        selectionToAction,
    } from '@model/assignment-utils.ts';
    import ActionPicker from './ActionPicker.svelte';
    import SequenceEditorDialog from './SequenceEditorDialog.svelte';

    interface Props {
        button: ScreenButtonConfig;
        activeState: State;
        remoteConfig: RemoteConfig;
        onConfigUpdate: (updated: RemoteConfig) => void;
        onRename: (updated: ScreenButtonConfig) => void;
        onDelete: () => void;
    }

    let { button, activeState, remoteConfig, onConfigUpdate, onRename, onDelete }: Props = $props();

    let isRenamingLabel      = $state(false);
    let pendingLabel         = $state('');
    let isAssigning          = $state(false);
    let isChangingAssignment = $state(false);
    let sequenceEditorOpen   = $state(false);
    let sequenceEditorInitialSteps = $state<ActionPickerSelection[]>([]);
    let sequenceEditorInitialName  = $state<string | undefined>(undefined);
    let isEditingNamedSequence = $state(false);

    let currentAssignment = $derived(button.assignment ?? null);
    let isAssigned = $derived(currentAssignment !== null);

    let currentSequence = $derived(
        currentAssignment?.kind === 'sequence'
            ? remoteConfig.sequences.find(s => s.id === currentAssignment.sequenceId) ?? null
            : null
    );

    let currentSequenceMeta = $derived(
        currentAssignment?.kind === 'sequence'
            ? remoteConfig.metadata.sequenceMetadata.find(m => m.sequenceId === currentAssignment.sequenceId) ?? null
            : null
    );

    let isNamed = $derived(
        currentAssignment?.kind === 'sequence' && currentSequenceMeta?.name !== undefined
    );

    let showPicker = $derived(!isAssigned || isChangingAssignment);
    let showAssignmentPanel = $derived(isAssigning || isChangingAssignment);

    let namedSequences = $derived(
        remoteConfig.metadata.sequenceMetadata.filter(m => m.name !== undefined)
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

    function handleRenameKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') commitRename();
        if (e.key === 'Escape') isRenamingLabel = false;
    }

    function applyAssignment(config: RemoteConfig, newAssignment: ScreenButtonConfig['assignment'] & object): RemoteConfig {
        const updatedButtons = activeState.screenButtons.map(b =>
            b.id === button.id ? { ...b, assignment: newAssignment } : b
        );
        const updatedState: State = { ...activeState, screenButtons: updatedButtons };
        return { ...config, states: config.states.map(s => s.id === activeState.id ? updatedState : s) };
    }

    function assignSingleAction(selection: ActionPickerSelection) {
        const previousAssignment = button.assignment ?? null;
        const updated = buildSingleActionConfig(selection, previousAssignment, remoteConfig, applyAssignment);
        isChangingAssignment = false;
        isAssigning = false;
        onConfigUpdate(updated);
    }

    function assignMultiActionSequence(result: SequenceEditorConfirmation) {
        const previousAssignment = button.assignment ?? null;
        const updated = buildMultiActionConfig(result.steps, result.name, result.delayMs, previousAssignment, remoteConfig, applyAssignment);
        isChangingAssignment = false;
        isAssigning = false;
        sequenceEditorOpen = false;
        onConfigUpdate(updated);
    }

    function updateNamedSequence(result: SequenceEditorConfirmation) {
        if (!currentSequence) return;

        const actions = result.steps.map(selectionToAction);
        const updatedSequence: Sequence = { ...currentSequence, actions };
        const updatedMeta: SequenceMetadata = {
            sequenceId: currentSequence.id,
            name: result.name ?? currentSequenceMeta?.name,
            ...(result.delayMs !== 200 ? { delayMs: result.delayMs } : {}),
        };

        const updatedConfig: RemoteConfig = {
            ...remoteConfig,
            sequences: remoteConfig.sequences.map(s => s.id === currentSequence.id ? updatedSequence : s),
            metadata: {
                ...remoteConfig.metadata,
                sequenceMetadata: remoteConfig.metadata.sequenceMetadata.map(m =>
                    m.sequenceId === currentSequence.id ? updatedMeta : m
                ),
            },
        };

        isEditingNamedSequence = false;
        sequenceEditorOpen = false;
        onConfigUpdate(updatedConfig);
    }

    function assignNamedSequence(sequenceId: SequenceId) {
        const previousAssignment = button.assignment ?? null;
        const newAssignment = { kind: 'sequence' as const, sequenceId };
        let updated = applyAssignment({ ...remoteConfig }, newAssignment);
        if (previousAssignment?.kind === 'sequence') updated = garbageCollect(updated);
        isChangingAssignment = false;
        isAssigning = false;
        onConfigUpdate(updated);
    }

    function removeAssignment() {
        const previousAssignment = button.assignment ?? null;
        const updatedButtons = activeState.screenButtons.map(b =>
            b.id === button.id ? { ...b, assignment: null } : b
        );
        const updatedState: State = { ...activeState, screenButtons: updatedButtons };
        let updated: RemoteConfig = { ...remoteConfig, states: remoteConfig.states.map(s => s.id === activeState.id ? updatedState : s) };
        if (previousAssignment?.kind === 'sequence') updated = garbageCollect(updated);
        isAssigning = false;
        onConfigUpdate(updated);
    }

    function openSequenceEditor() {
        sequenceEditorInitialSteps = [];
        sequenceEditorInitialName = undefined;
        isEditingNamedSequence = false;
        sequenceEditorOpen = true;
    }

    function openNamedSequenceEditor() {
        if (!currentSequence) return;
        sequenceEditorInitialSteps = reconstructSteps(currentSequence, remoteConfig);
        sequenceEditorInitialName = currentSequenceMeta?.name;
        isEditingNamedSequence = true;
        sequenceEditorOpen = true;
    }

    function handleSequenceEditorConfirm(result: SequenceEditorConfirmation) {
        if (isEditingNamedSequence) {
            updateNamedSequence(result);
        } else {
            assignMultiActionSequence(result);
        }
    }

    function buttonFriendlyName(buttonCode: string): string {
        return buttonCode;
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
                        {assignmentLabel(currentAssignment, remoteConfig)}
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
                <ActionPicker
                    devices={remoteConfig.devices}
                    functions={remoteConfig.functions}
                    states={remoteConfig.states}
                    onSelect={assignSingleAction}
                />

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
                            {#each namedSequences as meta (meta.sequenceId)}
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <!-- svelte-ignore a11y_no_static_element_interactions -->
                                <div
                                    class="saved-sequence-row flex items-center justify-between px-2 py-1 rounded cursor-pointer"
                                    onclick={() => assignNamedSequence(meta.sequenceId)}
                                >
                                    <span class="text-sm">{meta.name}</span>
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
                {@const usedBy = isNamed && currentSequence
                    ? findButtonsUsingSequence(currentSequence.id, remoteConfig, buttonFriendlyName)
                    : []}

                <div class="flex flex-col gap-3">
                    <div class="assignment-label flex items-center gap-2 px-3 py-2 rounded-md">
                        {#if isNamed}
                            <ListVideoIcon class="size-4 text-surface-500-400 shrink-0" />
                        {:else}
                            <ZapIcon class="size-4 text-surface-500-400 shrink-0" />
                        {/if}
                        <span class="text-sm flex-1 min-w-0 truncate">{assignmentLabel(currentAssignment, remoteConfig)}</span>
                    </div>

                    {#if isNamed && usedBy.length > 1}
                        <div class="flex items-center gap-2 p-3 rounded preset-tonal-warning">
                            <TriangleAlertIcon class="size-4 shrink-0" />
                            <span class="text-xs">Used by {usedBy.length} buttons. Editing will affect all of them.</span>
                        </div>
                    {/if}

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
                        <button class="btn-icon hover:preset-tonal text-error-500" title="Remove assignment" onclick={removeAssignment}>
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
    devices={remoteConfig.devices}
    functions={remoteConfig.functions}
    states={remoteConfig.states}
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
