<script lang="ts">
    import { configStore } from '@stores/config-store.svelte.ts';
    import ScreenButtonList from './ScreenButtonList.svelte';
</script>

<ScreenButtonList state={configStore.selectedState} />
