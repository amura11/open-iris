<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
    import '@shoelace-style/shoelace/dist/components/button/button.js';
    import '@shoelace-style/shoelace/dist/components/divider/divider.js';
    import type { State } from '@model/state.ts';
    import type { ScreenButtonConfig } from '@model/actions.ts';
    import ScreenButtonEditor from '@components/ScreenButtonEditor.svelte';

    interface Props {
        state: State;
        onUpdate?: (updated: State) => void;
    }

    // Destructured as `stateData` to avoid naming conflict with the $state rune
    let { state: stateData, onUpdate }: Props = $props();

    let editingButtonId = $state<number | null>(null);

    let nextButtonId = $derived(
        stateData.screenButtons.reduce((max, btn) => Math.max(max, btn.id), 0) + 1
    );

    function addButton() {
        const newButton: ScreenButtonConfig = { id: nextButtonId, label: 'New Button', sequenceId: 0 };
        onUpdate?.({ ...stateData, screenButtons: [...stateData.screenButtons, newButton] });
        editingButtonId = newButton.id;
    }

    function removeButton(id: number) {
        if (editingButtonId === id) editingButtonId = null;
        onUpdate?.({ ...stateData, screenButtons: stateData.screenButtons.filter(b => b.id !== id) });
    }

    function saveButton(updated: ScreenButtonConfig) {
        onUpdate?.({ ...stateData, screenButtons: stateData.screenButtons.map(b => b.id === updated.id ? updated : b) });
        editingButtonId = null;
    }
</script>

<div class="item-list d-flex flex-col gap-xs">
    {#if stateData.screenButtons.length === 0}
        <p class="text-s text-muted text-center m-0 py-m">No buttons yet. Add one below.</p>
    {:else}
        {#each stateData.screenButtons as btn (btn.id)}
            {#if editingButtonId === btn.id}
                <ScreenButtonEditor
                    button={btn}
                    onSave={saveButton}
                    onCancel={() => (editingButtonId = null)}
                />
            {:else}
                <div class="item-row d-flex items-center gap-xs rounded-m">
                    <span class="flex-1 truncate text-s">{btn.label}</span>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <sl-icon-button
                        name="pencil"
                        label="Rename button"
                        onclick={() => (editingButtonId = btn.id)}
                    ></sl-icon-button>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <sl-icon-button
                        name="trash"
                        label="Delete button"
                        class="danger-icon"
                        onclick={() => removeButton(btn.id)}
                    ></sl-icon-button>
                </div>
            {/if}
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

    .item-row {
        padding: var(--sl-spacing-2x-small) var(--sl-spacing-x-small);
        border: 1px solid transparent;
        transition: background-color 0.1s, border-color 0.1s;
    }

    .item-row:hover {
        background-color: color-mix(in srgb, var(--color-primary) 6%, transparent);
        border-color: var(--color-border);
    }

    :global(.danger-icon)::part(base):hover {
        color: var(--sl-color-danger-600);
    }
</style>
