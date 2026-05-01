<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/button/button.js';
    import type { Item } from '@model/state.ts';

    interface Props {
        item: Item;
        onSave?: (updated: Item) => void;
        onCancel?: () => void;
    }

    let { item, onSave, onCancel }: Props = $props();

    // svelte-ignore state_referenced_locally — intentional snapshot; $effect below re-syncs on item change
    let label = $state(item.label);

    $effect(() => {
        label = item.label;
    });

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') onSave?.({ ...item, label });
        if (e.key === 'Escape') onCancel?.();
    }
</script>

<div class="item-editor d-flex items-center gap-xs">
    <!-- svelte-ignore a11y_autofocus -->
    <input
        class="edit-input flex-1"
        bind:value={label}
        onkeydown={handleKeydown}
        autofocus
    />
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <sl-button size="small" variant="primary" onclick={() => onSave?.({ ...item, label })}>
        Save
    </sl-button>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <sl-button size="small" onclick={() => onCancel?.()}>
        Cancel
    </sl-button>
</div>

<style>
    .edit-input {
        flex: 1;
        min-width: 0;
        border: 1px solid var(--color-border);
        border-radius: var(--sl-border-radius-medium);
        padding: 0 var(--sl-spacing-small);
        background: var(--color-surface);
        color: var(--color-text-primary);
        font-family: var(--font-sans);
        font-size: var(--sl-font-size-small);
        height: 2rem;
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
    }

    .edit-input:focus {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 var(--sl-focus-ring-width) var(--sl-focus-ring-color);
    }
</style>
