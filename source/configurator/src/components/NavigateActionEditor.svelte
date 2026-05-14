<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/select/select.js';
    import '@shoelace-style/shoelace/dist/components/option/option.js';
    import '@shoelace-style/shoelace/dist/components/button/button.js';
    import type { State } from '@model/state.ts';

    interface Props {
        states: State[];
        onConfirm: (targetStateId: number) => void;
        onCancel: () => void;
    }

    let { states, onConfirm, onCancel }: Props = $props();

    let selectedStateId = $state('');

    function handleConfirm() {
        const id = Number(selectedStateId);

        if (id) {
            onConfirm(id);
        }
    }
</script>

<div class="d-flex flex-col gap-xs">
    <sl-select
        size="small"
        placeholder="Select target state…"
        value={selectedStateId}
        onsl-change={(e: Event) => { selectedStateId = (e.target as HTMLSelectElement).value; }}
    >
        {#each states as state (state.id)}
            <sl-option value={String(state.id)}>{state.name}</sl-option>
        {/each}
    </sl-select>
    <div class="d-flex gap-xs justify-end">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <sl-button size="small" variant="text" onclick={onCancel}>Cancel</sl-button>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <sl-button size="small" variant="primary" disabled={!selectedStateId} onclick={handleConfirm}>Confirm</sl-button>
    </div>
</div>
