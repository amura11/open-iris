<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/button/button.js';
    import '@shoelace-style/shoelace/dist/components/divider/divider.js';
    import type { State, RemoteConfig } from '@model/state.ts';
    import type { ScreenButtonConfig } from '@model/actions.ts';
    import { garbageCollect } from '@model/assignment-utils.ts';
    import ScreenButtonRow from '@components/ScreenButtonRow.svelte';

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
        const newButton: ScreenButtonConfig = { id: nextButtonId, label: 'New Button', sequenceId: 0 };
        onUpdate?.({ ...stateData, screenButtons: [...stateData.screenButtons, newButton] });
    }

    function renameButton(updated: ScreenButtonConfig) {
        onUpdate?.({ ...stateData, screenButtons: stateData.screenButtons.map(b => b.id === updated.id ? updated : b) });
    }

    function removeButton(btn: ScreenButtonConfig) {
        const updatedButtons = stateData.screenButtons.filter(b => b.id !== btn.id);
        const updatedState: State = { ...stateData, screenButtons: updatedButtons };

        if (btn.sequenceId !== 0 && onConfigUpdate) {
            let updated: RemoteConfig = { ...remoteConfig, states: remoteConfig.states.map(s => s.id === updatedState.id ? updatedState : s) };
            onConfigUpdate(garbageCollect(updated));
        } else {
            onUpdate?.(updatedState);
        }
    }
</script>

<div class="item-list d-flex flex-col gap-xs">
    {#if stateData.screenButtons.length === 0}
        <p class="text-s text-muted text-center m-0 py-m">No buttons yet. Add one below.</p>
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

    <sl-divider></sl-divider>

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <sl-button size="small" onclick={addButton}>
        Add Button
    </sl-button>
</div>

<style>
    .item-list {
        /* inherited from ItemList */
    }
</style>
