<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/button/button.js';
    import '@shoelace-style/shoelace/dist/components/icon/icon.js';
    import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
    import '@shoelace-style/shoelace/dist/components/alert/alert.js';
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
        const updated = buildMultiActionConfig(result.steps, result.name, previousAssignment, remoteConfig, applyAssignment);
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

<div class="row-wrapper d-flex flex-col rounded-m" class:expanded={showAssignmentPanel}>

    <!-- ── Summary row ────────────────────────────────────────── -->
    <div class="item-row d-flex items-center gap-xs">
        {#if isRenamingLabel}
            <!-- svelte-ignore a11y_autofocus -->
            <input
                class="edit-input flex-1"
                bind:value={pendingLabel}
                onkeydown={handleRenameKeydown}
                autofocus
            />
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <sl-button size="small" variant="primary" onclick={commitRename}>Save</sl-button>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <sl-button size="small" onclick={() => { isRenamingLabel = false; }}>Cancel</sl-button>
        {:else}
            <div class="d-flex flex-col flex-1 min-w-0 gap-2xs">
                <span class="truncate text-s">{button.label}</span>

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
            <sl-icon-button name="pencil" label="Rename button" onclick={startRename}></sl-icon-button>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <sl-icon-button name="trash" label="Delete button" class="danger-icon" onclick={onDelete}></sl-icon-button>
        {/if}
    </div>

    <!-- ── Assignment panel (expands below row) ──────────────────────── -->
    {#if showAssignmentPanel}
        <div class="assignment-panel d-flex flex-col gap-s p-s border-top">
            {#if showPicker}
                <ActionPicker
                    devices={remoteConfig.devices}
                    functions={remoteConfig.functions}
                    states={remoteConfig.states}
                    onSelect={assignSingleAction}
                />

                <sl-divider></sl-divider>

                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <sl-button size="small" onclick={openSequenceEditor}>
                    <sl-icon slot="prefix" name="list-ul"></sl-icon>
                    Multi-action sequence…
                </sl-button>

                {#if namedSequences.length > 0}
                    <div>
                        <div class="text-xs text-muted uppercase tracking-looser mb-xs">Saved sequences</div>
                        <div class="d-flex flex-col gap-2xs">
                            {#each namedSequences as meta (meta.sequenceId)}
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <!-- svelte-ignore a11y_no_static_element_interactions -->
                                <div
                                    class="saved-sequence-row d-flex items-center justify-between px-xs py-2xs rounded-s cursor-pointer"
                                    onclick={() => assignNamedSequence(meta.sequenceId)}
                                >
                                    <span class="text-s">{meta.name}</span>
                                    <sl-icon name="arrow-right" class="text-xs text-muted"></sl-icon>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <sl-button size="small" variant="text" onclick={() => { isAssigning = false; isChangingAssignment = false; }}>
                    Cancel
                </sl-button>

            {:else if currentAssignment}
                {@const usedBy = isNamed && currentSequence
                    ? findButtonsUsingSequence(currentSequence.id, remoteConfig, buttonFriendlyName)
                    : []}

                <div class="d-flex flex-col gap-s">
                    <div class="assignment-label d-flex items-center gap-xs px-s py-xs rounded-m">
                        <sl-icon name={isNamed ? 'collection-play' : 'lightning-charge'} class="text-s text-muted shrink-0"></sl-icon>
                        <span class="text-s flex-1 min-w-0 truncate">{assignmentLabel(currentAssignment, remoteConfig)}</span>
                    </div>

                    {#if isNamed && usedBy.length > 1}
                        <sl-alert variant="warning" open>
                            <sl-icon slot="icon" name="exclamation-triangle"></sl-icon>
                            <span class="text-xs">Used by {usedBy.length} buttons. Editing will affect all of them.</span>
                        </sl-alert>
                    {/if}

                    <div class="d-flex gap-xs">
                        {#if isNamed}
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <sl-button size="small" onclick={openNamedSequenceEditor}>Edit sequence</sl-button>
                        {/if}
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <sl-button size="small" onclick={() => { isChangingAssignment = true; }}>Replace</sl-button>
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <sl-icon-button name="trash" label="Remove assignment" onclick={removeAssignment}></sl-icon-button>
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <sl-button size="small" variant="text" class="ml-auto" onclick={() => { isAssigning = false; }}>Done</sl-button>
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
        background-color: color-mix(in srgb, var(--color-primary) 6%, transparent);
        border-color: var(--color-border);
    }

    .row-wrapper.expanded {
        border-color: var(--color-border);
    }

    .item-row {
        padding: var(--sl-spacing-2x-small) var(--sl-spacing-x-small);
    }

    .assignment-panel {
        border-top-color: var(--color-border);
    }

    .assignment-chip {
        color: var(--color-primary);
        border-bottom: 1px dashed var(--color-primary);
        opacity: 0.8;
    }

    .assignment-chip:hover {
        opacity: 1;
    }

    .unassigned-chip {
        color: var(--color-text-secondary);
        border-bottom: 1px dashed var(--color-text-secondary);
    }

    .unassigned-chip:hover {
        color: var(--color-text-primary);
    }

    .assignment-label {
        background: var(--sl-color-neutral-50);
        border: 1px solid var(--color-border);
    }

    .saved-sequence-row {
        border: 1px solid var(--color-border);
        transition: background-color 0.1s;
    }

    .saved-sequence-row:hover {
        background: var(--sl-color-neutral-50);
    }

    .edit-input {
        flex: 1;
        min-width: 0;
        border: 1px solid var(--color-border);
        border-radius: var(--sl-border-radius-medium);
        padding: 0 var(--sl-spacing-small);
        background: var(--color-surface);
        color: var(--color-text-primary);
        font-family: var(--font-sans);
        font-size: var(--sl-font-size-small);
        height: 2rem;
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
    }

    .edit-input:focus {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 var(--sl-focus-ring-width) var(--sl-focus-ring-color);
    }

    :global(.danger-icon)::part(base):hover {
        color: var(--sl-color-danger-600);
    }
</style>
