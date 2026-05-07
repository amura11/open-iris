<script lang="ts">
    import type { State } from '@model/state.ts';
    import ScreenButtonList from '@components/ScreenButtonList.svelte';

    interface Props {
        state: State;
        onUpdate?: (updated: State) => void;
    }

    let { state, onUpdate }: Props = $props();
</script>

<ScreenButtonList {state} onUpdate={onUpdate} />
