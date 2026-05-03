<script lang="ts">
    import type { State } from '@model/state.ts';
    import ItemList from '@components/ItemList.svelte';

    interface Props {
        state: State;
        onUpdate?: (updated: State) => void;
    }

    let { state, onUpdate }: Props = $props();
</script>

<ItemList {state} onUpdate={onUpdate} />
