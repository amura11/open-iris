<script lang="ts">
    import { ChevronLeftIcon, ChevronRightIcon } from '@lucide/svelte';
    import type { Selection } from '@model/selection.ts';
    import type { RemoteLayout } from '@layout/layout-types.ts';
    import type { State, RemoteConfig } from '@model/state.ts';
    import ScreenInspector from '@components/ScreenInspector.svelte';
    import ButtonInspector from '@components/ButtonInspector.svelte';

    interface Props {
        selection: Selection;
        layout: RemoteLayout;
        activeState: State;
        remoteConfig: RemoteConfig;
        width: number;
        collapsed: boolean;
        onStateUpdate?: (updated: State) => void;
        onConfigUpdate?: (updated: RemoteConfig) => void;
        onToggleCollapse?: () => void;
        onClearSelection?: () => void;
    }

    let { selection, layout, activeState, remoteConfig, width, collapsed, onStateUpdate, onConfigUpdate, onToggleCollapse, onClearSelection }: Props = $props();

    let activeButton = $derived.by(() => {
        if (selection?.type !== 'button') return null;
        return layout.buttons.find(b => b.buttonCode === selection.buttonCode) ?? null;
    });

    let panelTitle = $derived(
        selection?.type === 'button' ? 'Assign Button' :
        selection?.type === 'screen' ? 'Screen' :
        'Properties'
    );

    let buttonLabel = $derived(activeButton?.friendlyName ?? activeButton?.buttonCode ?? null);

    let clearAssignment = $state<(() => void) | null>(null);
</script>

<aside
    class="inspector flex flex-col border-l border-surface-200-800 bg-surface-50-900 shrink-0 overflow-hidden"
    class:collapsed
    style={collapsed ? undefined : `width: ${width}px`}
>
    {#if collapsed}
        <div class="flex flex-col items-center pt-2 h-full">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button class="btn-icon hover:preset-tonal" title="Expand properties panel" onclick={onToggleCollapse}>
                <ChevronLeftIcon class="size-4" />
            </button>
        </div>
    {:else}
        <div class="flex items-center justify-between px-4 py-2 border-b border-surface-200-800 shrink-0 min-h-10 gap-2">
            <span class="text-sm font-semibold shrink-0">{panelTitle}</span>
            <div class="flex items-center gap-2 flex-1 min-w-0 justify-end">
                {#if buttonLabel}
                    <span class="badge preset-tonal rounded-full truncate">{buttonLabel}</span>
                {/if}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <button class="btn-icon hover:preset-tonal shrink-0" title="Collapse properties panel" onclick={onToggleCollapse}>
                    <ChevronRightIcon class="size-4" />
                </button>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto flex flex-col">
            <div class="p-4 flex-1 flex flex-col">
                {#if selection?.type === 'screen'}
                    <ScreenInspector state={activeState} {remoteConfig} onUpdate={onStateUpdate} onConfigUpdate={onConfigUpdate ?? (() => {})} />
                {:else if selection?.type === 'button' && activeButton}
                    <ButtonInspector
                        button={activeButton}
                        {layout}
                        {activeState}
                        {remoteConfig}
                        onConfigUpdate={onConfigUpdate ?? (() => {})}
                        bind:clearAssignment
                    />
                {:else}
                    <p class="text-sm text-surface-500-400 text-center mt-8">Select a button or the screen to view its properties.</p>
                {/if}
            </div>
        </div>

        <div class="p-3 border-t border-surface-200-800 shrink-0 flex gap-2">
            {#if clearAssignment}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <button
                    class="btn btn-sm hover:preset-tonal"
                    onclick={clearAssignment}
                >Clear</button>
            {/if}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button
                class="btn btn-sm preset-filled-primary-500 flex-1"
                disabled={!selection}
                onclick={onClearSelection}
            >Done</button>
        </div>
    {/if}
</aside>

<style>
    .inspector.collapsed { width: 2.5rem; }
</style>
