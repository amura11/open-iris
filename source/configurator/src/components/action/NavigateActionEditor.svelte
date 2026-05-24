<script lang="ts">
    import { configuratorStore } from '@stores/configurator-store.svelte.ts';

    interface Props {
        onConfirm: (targetStateId: number) => void;
        onCancel: () => void;
    }

    let { onConfirm, onCancel }: Props = $props();

    let states = $derived(configuratorStore.states);

    let selectedStateId = $state('');

    function handleConfirm() {
        const id = Number(selectedStateId);
        if (id) onConfirm(id);
    }
</script>

<div class="flex flex-col gap-2">
    <select
        class="select"
        value={selectedStateId}
        onchange={(e: Event) => { selectedStateId = (e.target as HTMLSelectElement).value; }}
    >
        <option value="" disabled selected>Select target state…</option>
        {#each states as state (state.id)}
            <option value={String(state.id)}>{state.name}</option>
        {/each}
    </select>
    <div class="flex gap-2 justify-end">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <button class="btn btn-sm hover:preset-tonal" onclick={onCancel}>Cancel</button>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <button class="btn btn-sm preset-filled-primary-500" disabled={!selectedStateId} onclick={handleConfirm}>Confirm</button>
    </div>
</div>
