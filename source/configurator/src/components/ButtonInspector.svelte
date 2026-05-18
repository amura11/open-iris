<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/button/button.js';
    import '@shoelace-style/shoelace/dist/components/icon/icon.js';
    import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
    import '@shoelace-style/shoelace/dist/components/divider/divider.js';
    import type { ButtonDescriptor, RemoteLayout } from '@layout/layout-types.ts';
    import type { State, RemoteConfig } from '@model/state.ts';
    import type { ActionPickerSelection } from '@model/configurator-types.ts';
    import {
        garbageCollect,
        buildSingleActionConfig,
        buildMultiActionConfig,
        updateSequenceInPlace,
    } from '@model/assignment-utils.ts';
    import ButtonActionPanel from './ButtonActionPanel.svelte';

    interface Props {
        button:         ButtonDescriptor;
        layout:         RemoteLayout;
        activeState:    State;
        remoteConfig:   RemoteConfig;
        onConfigUpdate: (updated: RemoteConfig) => void;
    }

    let { button, layout, activeState, remoteConfig, onConfigUpdate }: Props = $props();

    let buttonConfig = $derived(
        activeState.physicalButtons.find(b => b.buttonCode === button.buttonCode) ?? null
    );

    let currentAssignment = $derived(buttonConfig?.assignment ?? null);

    let namedSequences = $derived(
        remoteConfig.metadata.sequenceMetadata
            .filter(m => m.name !== undefined)
            .map(m => ({ sequenceId: m.sequenceId, name: m.name! }))
    );

    function applyButtonAssignment(
        config: RemoteConfig,
        newAssignment: { kind: 'action'; deviceId: number; functionId: number; data: number } | { kind: 'sequence'; sequenceId: number }
    ): RemoteConfig {
        const previousAssignment = buttonConfig?.assignment ?? null;
        const newButtonConfig = { buttonCode: button.buttonCode, assignment: newAssignment };
        const updatedPhysicalButtons = previousAssignment !== null
            ? activeState.physicalButtons.map(b => b.buttonCode === button.buttonCode ? newButtonConfig : b)
            : [...activeState.physicalButtons, newButtonConfig];
        const updatedState: State = { ...activeState, physicalButtons: updatedPhysicalButtons };
        return { ...config, states: config.states.map(s => s.id === activeState.id ? updatedState : s) };
    }

    function assignSingleAction(selection: ActionPickerSelection) {
        const previousAssignment = buttonConfig?.assignment ?? null;
        const updated = buildSingleActionConfig(selection, previousAssignment, remoteConfig, applyButtonAssignment);
        onConfigUpdate(updated);
    }

    function assignMultiActionSequence(steps: ActionPickerSelection[], name: string | undefined, delayMs: number) {
        if (steps.length === 0) return;
        const previousAssignment = buttonConfig?.assignment ?? null;
        if (previousAssignment?.kind === 'sequence') {
            const updated = updateSequenceInPlace(
                previousAssignment.sequenceId, steps, name, delayMs, remoteConfig, applyButtonAssignment
            );
            onConfigUpdate(updated);
        } else {
            const updated = buildMultiActionConfig(steps, name, delayMs, previousAssignment, remoteConfig, applyButtonAssignment);
            onConfigUpdate(updated);
        }
    }

    function assignNamedSequence(sequenceId: number) {
        const previousAssignment = buttonConfig?.assignment ?? null;
        const newAssignment = { kind: 'sequence' as const, sequenceId };
        let updated = applyButtonAssignment(remoteConfig, newAssignment);
        if (previousAssignment?.kind === 'sequence') updated = garbageCollect(updated);
        onConfigUpdate(updated);
    }

    function removeAssignment() {
        const previousAssignment = buttonConfig?.assignment ?? null;
        const updatedState: State = {
            ...activeState,
            physicalButtons: activeState.physicalButtons.filter(b => b.buttonCode !== button.buttonCode),
        };
        let updated: RemoteConfig = {
            ...remoteConfig,
            states: remoteConfig.states.map(s => s.id === activeState.id ? updatedState : s),
        };
        if (previousAssignment?.kind === 'sequence') updated = garbageCollect(updated);
        onConfigUpdate(updated);
    }

</script>

<div class="d-flex flex-col gap-m">
    {#key button.buttonCode}
        <ButtonActionPanel
            devices={remoteConfig.devices}
            functions={remoteConfig.functions}
            states={remoteConfig.states}
            {remoteConfig}
            {namedSequences}
            currentAssignment={currentAssignment}
            onAssignSingle={assignSingleAction}
            onAssignSequence={assignMultiActionSequence}
            onAssignNamed={assignNamedSequence}
        />
    {/key}

    {#if currentAssignment}
        <sl-divider></sl-divider>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <sl-icon-button name="trash" label="Remove assignment" onclick={removeAssignment}></sl-icon-button>
    {/if}
</div>
