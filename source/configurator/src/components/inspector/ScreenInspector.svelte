<script lang="ts">
    import type { ScreenButton } from '@model/configurator-types.ts';
    import { configuratorStore } from '@stores/configurator-store.svelte.ts';
    import ScreenButtonList from './ScreenButtonList.svelte';
    import ScreenButtonInspector from './ScreenButtonInspector.svelte';

    interface Props {
        selectedButton: ScreenButton | null;
        onSelect:       (button: ScreenButton) => void;
    }

    let { selectedButton, onSelect }: Props = $props();
</script>

{#if selectedButton !== null}
    <ScreenButtonInspector button={selectedButton} />
{:else}
    <ScreenButtonList state={configuratorStore.selectedState} onSelect={onSelect} />
{/if}
