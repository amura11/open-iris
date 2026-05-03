<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
    import type { Selection } from '@model/selection.ts';
    import type { RemoteLayout } from '@layout/layout-types.ts';
    import type { State } from '@model/state.ts';
    import StateSettings from '@components/StateSettings.svelte';
    import ScreenInspector from '@components/ScreenInspector.svelte';
    import ButtonInspector from '@components/ButtonInspector.svelte';

    interface Props {
        selection: Selection;
        layout: RemoteLayout;
        activeState: State;
        width: number;
        collapsed: boolean;
        focusTrigger?: number;
        onStateUpdate?: (updated: State) => void;
        onToggleCollapse?: () => void;
        onClearSelection?: () => void;
    }

    let { selection, layout, activeState, width, collapsed, focusTrigger = 0, onStateUpdate, onToggleCollapse, onClearSelection }: Props = $props();

    const panelTitle = 'Properties';

    let activeButton = $derived.by(() => {
        const sel = selection;
        if (sel?.type !== 'button') return null;
        return layout.buttons.find(b => b.buttonCode === sel.buttonCode) ?? null;
    });
</script>

<aside
    class="inspector"
    class:collapsed
    style={collapsed ? undefined : `width: ${width}px`}
>
    {#if collapsed}
        <div class="collapsed-strip">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <sl-icon-button
                name="chevron-left"
                label="Expand properties panel"
                onclick={onToggleCollapse}
            ></sl-icon-button>
        </div>
    {:else}
        <div class="panel-header">
            <span class="panel-title">{panelTitle}</span>
            <div class="header-actions">
                {#if selection}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <sl-icon-button
                        name="x-lg"
                        label="Clear selection"
                        onclick={onClearSelection}
                    ></sl-icon-button>
                {/if}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <sl-icon-button
                    name="chevron-right"
                    label="Collapse properties panel"
                    onclick={onToggleCollapse}
                ></sl-icon-button>
            </div>
        </div>

        <div class="panel-body">
            <div class="state-section">
                <StateSettings
                    activeState={activeState}
                    focusTrigger={focusTrigger}
                    onUpdate={onStateUpdate}
                />
            </div>

            <hr class="section-divider" />

            <div class="selection-section">
                {#if selection?.type === 'screen'}
                    <ScreenInspector state={activeState} onUpdate={onStateUpdate} />
                {:else if selection?.type === 'button' && activeButton}
                    <ButtonInspector button={activeButton} />
                {:else}
                    <p class="placeholder">Select a button or the screen to view its properties.</p>
                {/if}
            </div>
        </div>
    {/if}
</aside>

<style>
    .inspector {
        display: flex;
        flex-direction: column;
        border-left: 1px solid var(--color-border);
        background: var(--color-surface);
        flex-shrink: 0;
        overflow: hidden;
    }

    .inspector.collapsed {
        width: 2.5rem;
    }

    .collapsed-strip {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding-top: var(--sl-spacing-x-small);
        height: 100%;
    }

    .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--sl-spacing-x-small) var(--sl-spacing-x-small) var(--sl-spacing-x-small) var(--sl-spacing-medium);
        border-bottom: 1px solid var(--color-border);
        flex-shrink: 0;
        min-height: 2.5rem;
    }

    .panel-title {
        font-family: var(--font-sans);
        font-size: var(--sl-font-size-small);
        font-weight: var(--sl-font-weight-semibold);
        color: var(--color-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
        min-width: 0;
    }

    .header-actions {
        display: flex;
        align-items: center;
        flex-shrink: 0;
    }

    .panel-body {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
    }

    .state-section {
        padding: var(--sl-spacing-medium);
        flex-shrink: 0;
    }

    .section-divider {
        border: none;
        border-top: 1px solid var(--color-border);
        margin: 0;
        flex-shrink: 0;
    }

    .selection-section {
        padding: var(--sl-spacing-medium);
        flex: 1;
    }

    .placeholder {
        margin: var(--sl-spacing-2x-large) 0 0;
        color: var(--color-text-secondary);
        font-size: var(--sl-font-size-small);
        text-align: center;
    }
</style>
