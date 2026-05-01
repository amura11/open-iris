<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/badge/badge.js';
    import type { Context } from '@model/context.ts';
    import ItemList from '@components/ItemList.svelte';

    interface Props {
        context: Context;
        onUpdate?: (updated: Context) => void;
    }

    let { context, onUpdate }: Props = $props();
</script>

<div class="d-flex flex-col gap-s h-full">
    <div class="d-flex items-center gap-xs">
        <sl-badge variant={context.canActivate ? 'primary' : 'neutral'} pill>
            {context.canActivate ? 'Activity' : 'Menu'}
        </sl-badge>
        <span class="text-2xs text-muted font-mono">id:{context.id}</span>
    </div>

    <ItemList {context} onUpdate={onUpdate} />
</div>
