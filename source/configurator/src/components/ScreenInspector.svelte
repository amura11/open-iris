<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/badge/badge.js';
    import '@shoelace-style/shoelace/dist/components/switch/switch.js';
    import type { State } from '@model/state.ts';
    import ItemList from '@components/ItemList.svelte';

    interface Props {
        state: State;
        onUpdate?: (updated: State) => void;
    }

    let { state, onUpdate }: Props = $props();

    const STATE_TYPE_LABEL: Record<string, string> = {
        root:       'Root',
        persistent: 'Persistent',
        ephemeral:  'Ephemeral',
    };

    const STATE_TYPE_VARIANT: Record<string, string> = {
        root:       'neutral',
        persistent: 'primary',
        ephemeral:  'warning',
    };
</script>

<div class="d-flex flex-col gap-s h-full">
    <div class="d-flex items-center gap-xs">
        <sl-badge variant={STATE_TYPE_VARIANT[state.stateType]} pill>
            {STATE_TYPE_LABEL[state.stateType]}
        </sl-badge>
        <span class="text-2xs text-muted font-mono">id:{state.id}</span>
    </div>

    {#if state.stateType === 'ephemeral'}
        <sl-switch
            checked={state.buttonFallback}
            onsl-change={(e: Event) => onUpdate?.({ ...state, buttonFallback: (e.target as HTMLInputElement).checked })}
        >
            Button fallback
        </sl-switch>
    {/if}

    <ItemList {state} onUpdate={onUpdate} />
</div>
