<script lang="ts">
    import { ChevronLeftIcon, ChevronRightIcon } from '@lucide/svelte';
    import { configStore } from '@stores/config-store.svelte.ts';
    import { uiStore } from '@stores/ui-store.svelte.ts';
    import { removePhysicalButtonAssignment } from '@services/assignment-service.ts';
    import ScreenInspector from './ScreenInspector.svelte';
    import ButtonInspector from './ButtonInspector.svelte';

    let selection  = $derived(uiStore.selection);
    let layout     = $derived(configStore.layout);
    let width      = $derived(uiStore.panel.width);
    let collapsed  = $derived(uiStore.panel.collapsed);

    let activeButton = $derived.by(() => {
        if (selection?.type !== 'button' || !layout) return null;
        return layout.buttons.find(b => b.buttonCode === selection.buttonCode) ?? null;
    });

    let panelTitle = $derived(
        selection?.type === 'button' ? 'Assign Button' :
        selection?.type === 'screen' ? 'Screen' :
        'Properties'
    );

    let buttonLabel = $derived(activeButton?.friendlyName ?? activeButton?.buttonCode ?? null);

    let canClear = $derived(
        selection?.type === 'button' &&
        configStore.selectedState.physicalButtons.some(b => b.buttonCode === selection.buttonCode)
    );

    function handleClear() {
        if (activeButton) {
            removePhysicalButtonAssignment(activeButton);
        }
    }
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
            <button class="btn-icon hover:preset-tonal" title="Expand properties panel" onclick={() => uiStore.togglePanel()}>
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
                <button class="btn-icon hover:preset-tonal shrink-0" title="Collapse properties panel" onclick={() => uiStore.togglePanel()}>
                    <ChevronRightIcon class="size-4" />
                </button>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto flex flex-col">
            <div class="p-4 flex-1 flex flex-col">
                {#if selection?.type === 'screen'}
                    <ScreenInspector />
                {:else if selection?.type === 'button' && activeButton}
                    <ButtonInspector button={activeButton} />
                {:else}
                    <p class="text-sm text-surface-500-400 text-center mt-8">Select a button or the screen to view its properties.</p>
                {/if}
            </div>
        </div>

        <div class="p-3 border-t border-surface-200-800 shrink-0 flex gap-2">
            {#if canClear}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <button
                    class="btn btn-sm hover:preset-tonal"
                    onclick={handleClear}
                >Clear</button>
            {/if}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button
                class="btn btn-sm preset-filled-primary-500 flex-1"
                disabled={!selection}
                onclick={() => uiStore.clearSelection()}
            >Done</button>
        </div>
    {/if}
</aside>

<style>
    .inspector.collapsed { width: 2.5rem; }
</style>
