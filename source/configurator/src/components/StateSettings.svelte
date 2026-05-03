<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/badge/badge.js';
    import '@shoelace-style/shoelace/dist/components/switch/switch.js';
    import '@shoelace-style/shoelace/dist/components/input/input.js';
    import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
    import '@shoelace-style/shoelace/dist/components/icon/icon.js';
    import { untrack } from 'svelte';
    import type SlInput from '@shoelace-style/shoelace/dist/components/input/input.component.js';
    import type { State, StateType } from '@model/state.ts';

    interface Props {
        activeState: State;
        focusTrigger?: number;
        onUpdate?: (updated: State) => void;
    }

    let { activeState, focusTrigger = 0, onUpdate }: Props = $props();

    let sectionOpen = $state(true);
    let nameInputEl: SlInput | null = $state(null);

    $effect(() => {
        if (focusTrigger > 0) {
            sectionOpen = true;
            const el = untrack(() => nameInputEl);
            setTimeout(() => (el as any)?.focus(), 0);
        }
    });

    function handleTypeChange(e: Event) {
        const checked = (e.target as HTMLInputElement).checked;
        onUpdate?.({
            ...activeState,
            stateType: (checked ? 'ephemeral' : 'persistent') as StateType,
        });
    }
</script>

<div class="state-settings">
    <button
        class="section-toggle"
        onclick={() => (sectionOpen = !sectionOpen)}
        aria-expanded={sectionOpen}
    >
        <span class="section-label">State Settings</span>
        <sl-icon name={sectionOpen ? 'chevron-up' : 'chevron-down'}></sl-icon>
    </button>

    {#if sectionOpen}
        <div class="section-body">
            <sl-input
                bind:this={nameInputEl}
                size="small"
                value={activeState.name}
                onsl-input={(e: Event) =>
                    onUpdate?.({ ...activeState, name: (e.target as HTMLInputElement).value })}
            ></sl-input>

            {#if activeState.stateType === 'root'}
                <sl-badge variant="neutral" pill>Root</sl-badge>
            {:else}
                <sl-switch
                    checked={activeState.stateType === 'ephemeral'}
                    onsl-change={handleTypeChange}
                >Ephemeral</sl-switch>
            {/if}

            {#if activeState.stateType !== 'root'}
                <sl-switch
                    checked={activeState.buttonFallback}
                    onsl-change={(e: Event) =>
                        onUpdate?.({ ...activeState, buttonFallback: (e.target as HTMLInputElement).checked })}
                >Button fallback</sl-switch>
            {/if}

            {#if activeState.stateType === 'persistent'}
                <div class="macro-row">
                    <span class="macro-label">On activate</span>
                    <span class="macro-hint">Not configured</span>
                    <sl-icon-button name="pencil" label="Edit on activate" disabled></sl-icon-button>
                </div>
                <div class="macro-row">
                    <span class="macro-label">On deactivate</span>
                    <span class="macro-hint">Not configured</span>
                    <sl-icon-button name="pencil" label="Edit on deactivate" disabled></sl-icon-button>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .state-settings {
        display: flex;
        flex-direction: column;
    }

    .section-toggle {
        all: unset;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--sl-spacing-x-small) 0;
        cursor: pointer;
        color: var(--color-text-primary);
        font-family: var(--font-sans);
        font-size: var(--sl-font-size-small);
        font-weight: var(--sl-font-weight-semibold);
        border-radius: var(--sl-border-radius-small);
    }

    .section-toggle:hover .section-label {
        color: var(--color-primary);
    }

    .section-body {
        display: flex;
        flex-direction: column;
        gap: var(--sl-spacing-small);
        padding-bottom: var(--sl-spacing-small);
    }

    .macro-row {
        display: flex;
        align-items: center;
        gap: var(--sl-spacing-small);
    }

    .macro-label {
        font-size: var(--sl-font-size-small);
        font-weight: var(--sl-font-weight-semibold);
        color: var(--color-text-primary);
        white-space: nowrap;
    }

    .macro-hint {
        flex: 1;
        font-size: var(--sl-font-size-x-small);
        color: var(--color-text-secondary);
    }
</style>
