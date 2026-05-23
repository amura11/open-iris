<script lang="ts">
    import type { State, ScreenButton } from '@model/configurator-types.ts';
    import { configStore } from '@stores/config-store.svelte.ts';
    import { removeScreenButtonAssignment } from '@services/assignment-service.ts';
    import ScreenButtonRow from './ScreenButtonRow.svelte';

    interface Props {
        state:    State;
        onSelect: (button: ScreenButton) => void;
    }

    // Destructured as `stateData` to avoid naming conflict with the $state rune
    let { state: stateData, onSelect }: Props = $props();

    let nextButtonId = $derived(
        stateData.screenButtons.reduce((max, btn) => Math.max(max, btn.id), 0) + 1
    );

    function addButton() {
        const newButton: ScreenButton = { id: nextButtonId, label: 'New Button', assignment: null };
        configStore.updateState({ ...stateData, screenButtons: [...stateData.screenButtons, newButton] });
    }

    function removeButton(button: ScreenButton) {
        const updatedState: State = { ...stateData, screenButtons: stateData.screenButtons.filter(b => b.id !== button.id) };
        configStore.updateState(updatedState);
        if (button.assignment?.kind === 'sequence') {
            configStore.deleteAnonymousSequence(button.assignment.sequenceId);
        }
    }
</script>

<div class="flex flex-col gap-2">
    {#if stateData.screenButtons.length === 0}
        <p class="text-sm text-surface-500-400 text-center m-0 py-4">No buttons yet. Add one below.</p>
    {:else}
        {#each stateData.screenButtons as btn (btn.id)}
            <ScreenButtonRow
                button={btn}
                onSelect={() => onSelect(btn)}
                onClear={() => removeScreenButtonAssignment(btn)}
                onDelete={() => removeButton(btn)}
            />
        {/each}
    {/if}

    <hr class="hr" />

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <button class="btn btn-sm hover:preset-tonal" onclick={addButton}>
        Add Button
    </button>
</div>
