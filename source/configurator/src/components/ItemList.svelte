<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
    import '@shoelace-style/shoelace/dist/components/button/button.js';
    import '@shoelace-style/shoelace/dist/components/divider/divider.js';
    import type { Context, Item } from '@model/context.ts';
    import ItemEditor from '@components/ItemEditor.svelte';

    interface Props {
        context: Context;
        onUpdate?: (updated: Context) => void;
    }

    let { context, onUpdate }: Props = $props();

    let editingItemId = $state<number | null>(null);

    let nextItemId = $derived(
        context.items.reduce((max, item) => Math.max(max, item.id), 0) + 1
    );

    function addItem() {
        const newItem: Item = { id: nextItemId, label: 'New Item' };
        onUpdate?.({ ...context, items: [...context.items, newItem] });
        editingItemId = newItem.id;
    }

    function removeItem(id: number) {
        if (editingItemId === id) editingItemId = null;
        onUpdate?.({ ...context, items: context.items.filter(i => i.id !== id) });
    }

    function saveItem(updated: Item) {
        onUpdate?.({ ...context, items: context.items.map(i => i.id === updated.id ? updated : i) });
        editingItemId = null;
    }
</script>

<div class="item-list d-flex flex-col gap-xs">
    {#if context.items.length === 0}
        <p class="text-s text-muted text-center m-0 py-m">No items yet. Add one below.</p>
    {:else}
        {#each context.items as item (item.id)}
            {#if editingItemId === item.id}
                <ItemEditor
                    {item}
                    onSave={saveItem}
                    onCancel={() => (editingItemId = null)}
                />
            {:else}
                <div class="item-row d-flex items-center gap-xs rounded-m">
                    <span class="flex-1 truncate text-s">{item.label}</span>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <sl-icon-button
                        name="pencil"
                        label="Rename item"
                        onclick={() => (editingItemId = item.id)}
                    ></sl-icon-button>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <sl-icon-button
                        name="trash"
                        label="Delete item"
                        class="danger-icon"
                        onclick={() => removeItem(item.id)}
                    ></sl-icon-button>
                </div>
            {/if}
        {/each}
    {/if}

    <sl-divider></sl-divider>

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <sl-button size="small" onclick={addItem}>
        Add Item
    </sl-button>
</div>

<style>
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
