<script lang="ts">
    import type { ScreenButtonConfig } from '@model/actions.ts';

    interface Props {
        button: ScreenButtonConfig;
        onSave?: (updated: ScreenButtonConfig) => void;
        onCancel?: () => void;
    }

    let { button, onSave, onCancel }: Props = $props();

    // svelte-ignore state_referenced_locally — intentional snapshot; $effect below re-syncs on button change
    let label = $state(button.label);

    $effect(() => {
        label = button.label;
    });

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') onSave?.({ ...button, label });
        if (e.key === 'Escape') onCancel?.();
    }
</script>

<div class="flex items-center gap-2">
    <!-- svelte-ignore a11y_autofocus -->
    <input
        class="input flex-1"
        bind:value={label}
        onkeydown={handleKeydown}
        autofocus
    />
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <button class="btn btn-sm preset-filled-primary-500" onclick={() => onSave?.({ ...button, label })}>
        Save
    </button>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <button class="btn btn-sm hover:preset-tonal" onclick={() => onCancel?.()}>
        Cancel
    </button>
</div>
