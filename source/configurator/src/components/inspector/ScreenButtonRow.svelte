<script lang="ts">
    import { Trash2Icon, XIcon } from '@lucide/svelte';
    import type { ScreenButton } from '@model/configurator-types.ts';
    import { assignmentLabel } from '@utils/label-utils.ts';
    import { configuratorStore } from '@stores/configurator-store.svelte.ts';

    interface Props {
        button:   ScreenButton;
        onSelect: () => void;
        onClear:  () => void;
        onDelete: () => void;
    }

    let { button, onSelect, onClear, onDelete }: Props = $props();

    let currentAssignment = $derived(button.assignment ?? null);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="item-row flex items-center gap-2 px-2 py-1 rounded-md" onclick={onSelect}>
    <div class="flex flex-col flex-1 min-w-0 gap-1">
        <span class="truncate text-sm">{button.label}</span>
        {#if currentAssignment}
            <span class="assignment-chip text-xs truncate">
                {assignmentLabel(currentAssignment, configuratorStore.devices, configuratorStore.sequences, configuratorStore.states)}
            </span>
        {:else}
            <span class="unassigned-chip text-xs">Unassigned</span>
        {/if}
    </div>
    {#if currentAssignment}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <button
            class="btn-icon hover:preset-tonal"
            title="Clear assignment"
            onclick={(e) => { e.stopPropagation(); onClear(); }}
        >
            <XIcon class="size-4" />
        </button>
    {/if}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <button
        class="btn-icon hover:preset-tonal text-error-500"
        title="Delete button"
        onclick={(e) => { e.stopPropagation(); onDelete(); }}
    >
        <Trash2Icon class="size-4" />
    </button>
</div>

<style>
    .item-row {
        border: 1px solid transparent;
        cursor: pointer;
        transition: border-color 0.1s, background-color 0.1s;
    }

    .item-row:hover {
        background-color: color-mix(in srgb, var(--color-primary-500) 6%, transparent);
        border-color: light-dark(var(--color-surface-200), var(--color-surface-700));
    }

    .assignment-chip {
        color: var(--color-primary-600);
        border-bottom: 1px dashed var(--color-primary-600);
        opacity: 0.8;
    }

    .unassigned-chip {
        color: light-dark(var(--color-surface-600), var(--color-surface-400));
    }
</style>
