<script lang="ts">
    import type { State, RemoteConfig } from '@model/state.ts';
    import type { ScreenButtonConfig } from '@model/actions.ts';
    import { garbageCollect } from '@model/assignment-utils.ts';
    import ScreenButtonRow from './ScreenButtonRow.svelte';

    interface Props {
        state: State;
        remoteConfig: RemoteConfig;
        onUpdate?: (updated: State) => void;
        onConfigUpdate?: (updated: RemoteConfig) => void;
    }

    // Destructured as `stateData` to avoid naming conflict with the $state rune
    let { state: stateData, remoteConfig, onUpdate, onConfigUpdate }: Props = $props();

    let nextButtonId = $derived(
        stateData.screenButtons.reduce((max, btn) => Math.max(max, btn.id), 0) + 1
    );

    function addButton() {
        const newButton: ScreenButtonConfig = { id: nextButtonId, label: 'New Button', assignment: null };
        onUpdate?.({ ...stateData, screenButtons: [...stateData.screenButtons, newButton] });
    }

    function renameButton(updated: ScreenButtonConfig) {
        onUpdate?.({ ...stateData, screenButtons: stateData.screenButtons.map(b => b.id === updated.id ? updated : b) });
    }

    function removeButton(btn: ScreenButtonConfig) {
        const updatedButtons = stateData.screenButtons.filter(b => b.id !== btn.id);
        const updatedState: State = { ...stateData, screenButtons: updatedButtons };

        if (btn.assignment?.kind === 'sequence' && onConfigUpdate) {
            let updated: RemoteConfig = { ...remoteConfig, states: remoteConfig.states.map(s => s.id === updatedState.id ? updatedState : s) };
            onConfigUpdate(garbageCollect(updated));
        } else {
            onUpdate?.(updatedState);
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
                activeState={stateData}
                {remoteConfig}
                onConfigUpdate={onConfigUpdate ?? (() => {})}
                onRename={renameButton}
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
