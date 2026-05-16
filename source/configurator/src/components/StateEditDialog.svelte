<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
    import '@shoelace-style/shoelace/dist/components/button/button.js';
    import '@shoelace-style/shoelace/dist/components/badge/badge.js';
    import '@shoelace-style/shoelace/dist/components/switch/switch.js';
    import '@shoelace-style/shoelace/dist/components/input/input.js';
    import '@shoelace-style/shoelace/dist/components/icon/icon.js';
    import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
    import type SlDialog from '@shoelace-style/shoelace/dist/components/dialog/dialog.component.js';
    import type SlInput from '@shoelace-style/shoelace/dist/components/input/input.component.js';
    import { untrack } from 'svelte';
    import type { State, StateType } from '@model/state.ts';

    interface Props {
        open:         boolean;
        mode:         'create' | 'edit';
        initialState: State;
        onConfirm:    (state: State) => void;
        onCancel:     () => void;
    }

    let { open, mode, initialState, onConfirm, onCancel }: Props = $props();

    let dialogEl:   SlDialog | null = $state(null);
    let nameInputEl: SlInput | null = $state(null);
    let draft = $state<State>({
        id: -1, name: '', stateType: 'persistent',
        screenButtons: [], physicalButtons: [],
        onActivate: null, onDeactivate: null,
        buttonFallback: false, activeDevices: [],
    });
    let justHandled = false;

    $effect(() => {
        if (open) {
            draft = { ...initialState };
            untrack(() => { dialogEl?.show(); });
        } else {
            dialogEl?.hide();
        }
    });

    function handleTypeChange(e: Event) {
        const checked = (e.target as HTMLInputElement).checked;
        draft = { ...draft, stateType: (checked ? 'ephemeral' : 'persistent') as StateType };
    }

    function handleConfirm() {
        justHandled = true;
        onConfirm({ ...draft });
        dialogEl?.hide();
    }

    function handleCancelClick() {
        justHandled = true;
        onCancel();
        dialogEl?.hide();
    }

    function handleAfterHide() {
        if (!justHandled) onCancel();
        justHandled = false;
    }
</script>

<sl-dialog
    bind:this={dialogEl}
    label={mode === 'create' ? 'Add State' : 'Edit State'}
    onsl-after-show={() => { if (mode === 'create') nameInputEl?.focus(); }}
    onsl-after-hide={handleAfterHide}
>
    <div class="d-flex flex-col gap-s">
        <sl-input
            bind:this={nameInputEl}
            size="small"
            value={draft.name}
            onsl-input={(e: Event) => { draft = { ...draft, name: (e.target as HTMLInputElement).value }; }}
        ></sl-input>

        {#if draft.stateType === 'root'}
            <sl-badge variant="neutral" pill>Root</sl-badge>
        {:else}
            <sl-switch
                checked={draft.stateType === 'ephemeral'}
                onsl-change={handleTypeChange}
            >Ephemeral</sl-switch>
        {/if}

        {#if draft.stateType !== 'root'}
            <sl-switch
                checked={draft.buttonFallback}
                onsl-change={(e: Event) => { draft = { ...draft, buttonFallback: (e.target as HTMLInputElement).checked }; }}
            >Button fallback</sl-switch>
        {/if}

        {#if draft.stateType === 'persistent'}
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

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <sl-button slot="footer" variant="text" onclick={handleCancelClick}>Cancel</sl-button>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <sl-button slot="footer" variant="primary" onclick={handleConfirm}>
        {mode === 'create' ? 'Add' : 'Save'}
    </sl-button>
</sl-dialog>

<style>
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
