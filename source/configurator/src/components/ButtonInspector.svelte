<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/badge/badge.js';
    import '@shoelace-style/shoelace/dist/components/button/button.js';
    import '@shoelace-style/shoelace/dist/components/icon/icon.js';
    import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
    import '@shoelace-style/shoelace/dist/components/divider/divider.js';
    import '@shoelace-style/shoelace/dist/components/alert/alert.js';
    import type { ButtonDescriptor, RemoteLayout } from '@layout/layout-types.ts';
    import type { State, RemoteConfig } from '@model/state.ts';
    import type { Sequence, SequenceAnnotation, SequenceId } from '@model/actions.ts';
    import type { ActionPickerSelection, SequenceEditorConfirmation } from '@model/configurator-types.ts';
    import {
        garbageCollect,
        assignmentLabel,
        reconstructSteps,
        findButtonsUsingSequence,
        buildSingleActionConfig,
        buildMultiActionConfig,
        materializeSteps,
    } from '@model/assignment-utils.ts';
    import ActionPicker from './ActionPicker.svelte';
    import SequenceEditorDialog from './SequenceEditorDialog.svelte';

    interface Props {
        button: ButtonDescriptor;
        layout: RemoteLayout;
        activeState: State;
        remoteConfig: RemoteConfig;
        onConfigUpdate: (updated: RemoteConfig) => void;
    }

    let { button, layout, activeState, remoteConfig, onConfigUpdate }: Props = $props();

    let isChangingAssignment = $state(false);
    let sequenceEditorOpen = $state(false);
    let sequenceEditorInitialSteps = $state<ActionPickerSelection[]>([]);
    let sequenceEditorInitialName = $state<string | undefined>(undefined);
    let isEditingNamedSequence = $state(false);

    let buttonConfig = $derived(
        activeState.physicalButtons.find(b => b.buttonCode === button.buttonCode) ?? null
    );

    let currentSequence = $derived(
        buttonConfig
            ? remoteConfig.sequences.find(s => s.id === buttonConfig.sequenceId) ?? null
            : null
    );

    let currentAnnotation = $derived(
        buttonConfig
            ? remoteConfig.metadata.sequenceAnnotations.find(a => a.sequenceId === buttonConfig.sequenceId) ?? null
            : null
    );

    let showPicker = $derived(!buttonConfig || isChangingAssignment);

    let namedSequences = $derived(
        remoteConfig.metadata.sequenceAnnotations.filter(a => a.name !== undefined)
    );

    function buttonFriendlyName(buttonCode: string): string {
        return layout.buttons.find(b => b.buttonCode === buttonCode)?.friendlyName ?? buttonCode;
    }

    function assignSingleAction(selection: ActionPickerSelection) {
        const previousSequenceId = buttonConfig?.sequenceId ?? null;

        const updated = buildSingleActionConfig(selection, previousSequenceId, remoteConfig, (config, newSequenceId) => {
            const newButtonConfig = { buttonCode: button.buttonCode, sequenceId: newSequenceId };
            const updatedPhysicalButtons = previousSequenceId !== null
                ? activeState.physicalButtons.map(b => b.buttonCode === button.buttonCode ? newButtonConfig : b)
                : [...activeState.physicalButtons, newButtonConfig];
            const updatedState: State = { ...activeState, physicalButtons: updatedPhysicalButtons };
            return { ...config, states: config.states.map(s => s.id === activeState.id ? updatedState : s) };
        });

        isChangingAssignment = false;
        onConfigUpdate(updated);
    }

    function assignMultiActionSequence(result: SequenceEditorConfirmation) {
        const previousSequenceId = buttonConfig?.sequenceId ?? null;

        const updated = buildMultiActionConfig(result.steps, result.name, previousSequenceId, remoteConfig, (config, newSequenceId) => {
            const newButtonConfig = { buttonCode: button.buttonCode, sequenceId: newSequenceId };
            const updatedPhysicalButtons = previousSequenceId !== null
                ? activeState.physicalButtons.map(b => b.buttonCode === button.buttonCode ? newButtonConfig : b)
                : [...activeState.physicalButtons, newButtonConfig];
            const updatedState: State = { ...activeState, physicalButtons: updatedPhysicalButtons };
            return { ...config, states: config.states.map(s => s.id === activeState.id ? updatedState : s) };
        });

        isChangingAssignment = false;
        sequenceEditorOpen = false;
        onConfigUpdate(updated);
    }

    function updateNamedSequence(result: SequenceEditorConfirmation) {
        if (!currentSequence) {
            return;
        }

        const { actions, newIRCodes } = materializeSteps(result.steps, remoteConfig.irCodes);
        const updatedSequence: Sequence = { ...currentSequence, actions };
        const updatedAnnotation: SequenceAnnotation = {
            sequenceId: currentSequence.id,
            name: result.name ?? currentAnnotation?.name,
        };

        const updatedConfig: RemoteConfig = {
            ...remoteConfig,
            sequences: remoteConfig.sequences.map(s => s.id === currentSequence.id ? updatedSequence : s),
            irCodes: newIRCodes.length > 0 ? [...remoteConfig.irCodes, ...newIRCodes] : remoteConfig.irCodes,
            metadata: {
                ...remoteConfig.metadata,
                sequenceAnnotations: remoteConfig.metadata.sequenceAnnotations.map(a =>
                    a.sequenceId === currentSequence.id ? updatedAnnotation : a
                ),
            },
        };

        isEditingNamedSequence = false;
        sequenceEditorOpen = false;
        onConfigUpdate(updatedConfig);
    }

    function assignNamedSequence(sequenceId: SequenceId) {
        const previousSequenceId = buttonConfig?.sequenceId ?? null;
        const newButtonConfig = { buttonCode: button.buttonCode, sequenceId };
        const updatedPhysicalButtons = previousSequenceId !== null
            ? activeState.physicalButtons.map(b => b.buttonCode === button.buttonCode ? newButtonConfig : b)
            : [...activeState.physicalButtons, newButtonConfig];
        const updatedState: State = { ...activeState, physicalButtons: updatedPhysicalButtons };
        let updated: RemoteConfig = { ...remoteConfig, states: remoteConfig.states.map(s => s.id === activeState.id ? updatedState : s) };
        if (previousSequenceId !== null) { updated = garbageCollect(updated); }
        isChangingAssignment = false;
        onConfigUpdate(updated);
    }

    function removeAssignment() {
        const updatedState: State = {
            ...activeState,
            physicalButtons: activeState.physicalButtons.filter(b => b.buttonCode !== button.buttonCode),
        };
        let updated: RemoteConfig = { ...remoteConfig, states: remoteConfig.states.map(s => s.id === activeState.id ? updatedState : s) };
        updated = garbageCollect(updated);
        onConfigUpdate(updated);
    }

    function openSequenceEditor() {
        sequenceEditorInitialSteps = [];
        sequenceEditorInitialName = undefined;
        isEditingNamedSequence = false;
        sequenceEditorOpen = true;
    }

    function openNamedSequenceEditor() {
        if (!currentSequence) { return; }
        sequenceEditorInitialSteps = reconstructSteps(currentSequence, remoteConfig);
        sequenceEditorInitialName = currentAnnotation?.name;
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
</script>

<div class="d-flex flex-col gap-m">
    <div class="d-flex items-center gap-m">
        <span class="text-s text-muted">Button code</span>
        <sl-badge variant="neutral" pill>
            <sl-icon name="code-slash" class="text-xs"></sl-icon>
            {button.buttonCode}
        </sl-badge>
    </div>

    <sl-divider></sl-divider>

    {#if showPicker}
        <div class="d-flex flex-col gap-m">
            <ActionPicker
                devices={remoteConfig.metadata.devices}
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
                        {#each namedSequences as annotation (annotation.sequenceId)}
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                                class="saved-sequence-row d-flex items-center justify-between px-xs py-2xs rounded-s cursor-pointer"
                                onclick={() => assignNamedSequence(annotation.sequenceId)}
                            >
                                <span class="text-s">{annotation.name}</span>
                                <sl-icon name="arrow-right" class="text-xs text-muted"></sl-icon>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if isChangingAssignment}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <sl-button size="small" variant="text" onclick={() => { isChangingAssignment = false; }}>
                    Cancel
                </sl-button>
            {/if}
        </div>

    {:else if currentSequence && currentAnnotation}
        {@const isNamed = currentAnnotation.name !== undefined}
        {@const usedBy = isNamed ? findButtonsUsingSequence(currentSequence.id, remoteConfig, buttonFriendlyName) : []}

        <div class="d-flex flex-col gap-s">
            <div class="assignment-label d-flex items-center gap-xs px-s py-xs rounded-m">
                <sl-icon name={isNamed ? 'collection-play' : 'lightning-charge'} class="text-s text-muted shrink-0"></sl-icon>
                <span class="text-s flex-1 min-w-0 truncate">{assignmentLabel(currentSequence, currentAnnotation, remoteConfig)}</span>
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
            </div>
        </div>
    {/if}
</div>

<SequenceEditorDialog
    open={sequenceEditorOpen}
    devices={remoteConfig.metadata.devices}
    states={remoteConfig.states}
    initialSteps={sequenceEditorInitialSteps}
    initialName={sequenceEditorInitialName}
    onConfirm={handleSequenceEditorConfirm}
    onCancel={() => { sequenceEditorOpen = false; }}
/>

<style>
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
</style>
