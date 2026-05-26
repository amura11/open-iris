<script lang="ts">
    import type { ButtonDescriptor } from '@layout/layout-types.ts';
    import type { SequenceStep } from '@model/configurator-types.ts';
    import { configuratorStore } from '@stores/configurator-store.svelte.ts';
    import ButtonActionPanel from './ButtonActionPanel.svelte';

    interface Props {
        button: ButtonDescriptor;
    }

    let { button }: Props = $props();

    let buttonConfig = $derived(
        configuratorStore.selectedState.physicalButtons.find(b => b.buttonCode === button.buttonCode) ?? null
    );

    let currentAssignment = $derived(buttonConfig?.assignment ?? null);

    function assignSingleAction(selection: SequenceStep) {
        configuratorStore.assignPhysicalButtonAction(button.buttonCode, selection);
    }

    function assignMultiActionSequence(steps: SequenceStep[], name: string | undefined, delayMs: number) {
        configuratorStore.assignPhysicalButtonAnonymousSequence(button.buttonCode, steps, name, delayMs);
    }

    function assignNamedSequence(sequenceId: number) {
        configuratorStore.assignPhysicalButtonNamedSequence(button.buttonCode, sequenceId);
    }
</script>

<div class="flex flex-col gap-4 flex-1 min-h-0">
    {#key button.buttonCode}
        <ButtonActionPanel
            {currentAssignment}
            onAssignSingle={assignSingleAction}
            onAssignSequence={assignMultiActionSequence}
            onAssignNamed={assignNamedSequence}
        />
    {/key}
</div>
