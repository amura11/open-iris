<script lang="ts">
    import type { State, RemoteConfig } from '@model/state.ts';
    import ScreenButtonList from '@components/ScreenButtonList.svelte';

    interface Props {
        state: State;
        remoteConfig: RemoteConfig;
        onUpdate?: (updated: State) => void;
        onConfigUpdate?: (updated: RemoteConfig) => void;
    }

    let { state, remoteConfig, onUpdate, onConfigUpdate }: Props = $props();
</script>

<ScreenButtonList {state} {remoteConfig} {onUpdate} {onConfigUpdate} />
