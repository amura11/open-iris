<script lang="ts">
    import type { ScreenButton, SequenceStep } from '@model/configurator-types.ts';
    import { configStore } from '@stores/config-store.svelte.ts';
    import {
        assignScreenButtonSingleAction,
        assignScreenButtonSequence,
        assignScreenButtonNamedSequence,
    } from '@services/assignment-service.ts';
    import ButtonActionPanel from './ButtonActionPanel.svelte';

    interface Props {
        button: ScreenButton;
    }

    let { button }: Props = $props();

    // svelte-ignore state_referenced_locally — intentional snapshot; $effect below re-syncs on button change
    let pendingLabel = $state(button.label);

    $effect(() => {
        pendingLabel = button.label;
    });

    let currentAssignment = $derived(button.assignment ?? null);

    function saveLabel() {
        const trimmed = pendingLabel.trim();
        if (!trimmed || trimmed === button.label) return;
        const activeState = configStore.selectedState;
        configStore.updateState({
            ...activeState,
            screenButtons: activeState.screenButtons.map(b =>
                b.id === button.id ? { ...b, label: trimmed } : b
            ),
        });
    }

    function handleLabelKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') (event.target as HTMLElement).blur();
        if (event.key === 'Escape') {
            pendingLabel = button.label;
            (event.target as HTMLElement).blur();
        }
    }

    function assignSingleAction(step: SequenceStep) {
        assignScreenButtonSingleAction(button, step);
    }

    function assignSequence(steps: SequenceStep[], name: string | undefined, delayMs: number) {
        assignScreenButtonSequence(button, { steps, name, delayMs });
    }

    function assignNamedSequence(sequenceId: number) {
        assignScreenButtonNamedSequence(button, sequenceId);
    }
</script>

<div class="flex flex-col gap-4 flex-1 min-h-0">
    <div class="flex flex-col gap-1">
        <label class="text-xs text-surface-500-400 uppercase tracking-wider">Label</label>
        <input
            class="input"
            bind:value={pendingLabel}
            onblur={saveLabel}
            onkeydown={handleLabelKeydown}
        />
    </div>

    {#key button.id}
        <ButtonActionPanel
            {currentAssignment}
            onAssignSingle={assignSingleAction}
            onAssignSequence={assignSequence}
            onAssignNamed={assignNamedSequence}
        />
    {/key}
</div>
