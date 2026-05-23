<script lang="ts">
    import { ChevronLeftIcon } from '@lucide/svelte';
    import type { ScreenButton } from '@model/configurator-types.ts';
    import { configStore } from '@stores/config-store.svelte.ts';
    import { uiStore } from '@stores/ui-store.svelte.ts';
    import { removePhysicalButtonAssignment } from '@services/assignment-service.ts';
    import ScreenInspector from './ScreenInspector.svelte';
    import PhysicalButtonInspector from './PhysicalButtonInspector.svelte';

    let selection = $derived(uiStore.selection);
    let layout    = $derived(configStore.layout);
    let width     = $derived(uiStore.panel.width);

    let activeButton = $derived.by(() => {
        if (selection?.type !== 'button' || !layout) return null;
        return layout.buttons.find(b => b.buttonCode === selection.buttonCode) ?? null;
    });

    let buttonLabel = $derived(activeButton?.friendlyName ?? activeButton?.buttonCode ?? null);

    let canClear = $derived(
        selection?.type === 'button' &&
        configStore.selectedState.physicalButtons.some(b => b.buttonCode === selection.buttonCode)
    );

    // ── Screen button detail navigation ──────────────────────────────────────

    let selectedScreenButtonId = $state<number | null>(null);

    let selectedScreenButton = $derived(
        selectedScreenButtonId !== null && selection?.type === 'screen'
            ? configStore.selectedState.screenButtons.find(b => b.id === selectedScreenButtonId) ?? null
            : null
    );

    $effect(() => {
        if (selection?.type !== 'screen') {
            selectedScreenButtonId = null;
        }
    });

    // ── Header ────────────────────────────────────────────────────────────────

    let headerTitle = $derived(
        selectedScreenButton         ? selectedScreenButton.label :
        selection?.type === 'button' ? 'Assign Button' :
        selection?.type === 'screen' ? 'Screen' :
        'Properties'
    );

    function handleClear() {
        if (activeButton) {
            removePhysicalButtonAssignment(activeButton);
        }
    }

    function handleSelectScreenButton(button: ScreenButton) {
        selectedScreenButtonId = button.id;
    }
</script>

<aside
    class="inspector flex flex-col border-l border-surface-200-800 bg-surface-50-900 shrink-0 overflow-hidden"
    style="width: {width}px"
>
    <div class="flex items-center px-4 py-2 border-b border-surface-200-800 shrink-0 min-h-10 gap-2">
        {#if selectedScreenButton}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button class="btn-icon hover:preset-tonal shrink-0" title="Back to screen buttons" onclick={() => { selectedScreenButtonId = null; }}>
                <ChevronLeftIcon class="size-4" />
            </button>
        {/if}
        <span class="text-sm font-semibold flex-1 min-w-0 truncate">{headerTitle}</span>
        {#if buttonLabel && !selectedScreenButton}
            <span class="badge preset-tonal rounded-full truncate">{buttonLabel}</span>
        {/if}
    </div>

    <div class="flex-1 overflow-y-auto flex flex-col">
        <div class="p-4 flex-1 flex flex-col">
            {#if selection?.type === 'screen'}
                <ScreenInspector
                    selectedButton={selectedScreenButton}
                    onSelect={handleSelectScreenButton}
                />
            {:else if selection?.type === 'button' && activeButton}
                <PhysicalButtonInspector button={activeButton} />
            {:else}
                <p class="text-sm text-surface-500-400 text-center mt-8">Select a button or the screen to view its properties.</p>
            {/if}
        </div>
    </div>

    <div class="p-3 border-t border-surface-200-800 shrink-0 flex gap-2">
        {#if canClear}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button class="btn btn-sm hover:preset-tonal" onclick={handleClear}>Clear</button>
        {/if}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <button
            class="btn btn-sm preset-filled-primary-500 flex-1"
            disabled={!selection}
            onclick={() => uiStore.clearSelection()}
        >Done</button>
    </div>
</aside>
