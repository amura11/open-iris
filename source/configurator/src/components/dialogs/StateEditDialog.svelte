<script lang="ts">
    import { PencilIcon } from '@lucide/svelte';
    import { Dialog, Portal, Switch } from '@skeletonlabs/skeleton-svelte';
    import { tick, untrack } from 'svelte';
    import type { State, StateType } from '@model/state.ts';

    interface Props {
        open:         boolean;
        mode:         'create' | 'edit';
        initialState: State;
        onConfirm:    (state: State) => void;
        onCancel:     () => void;
    }

    let { open, mode, initialState, onConfirm, onCancel }: Props = $props();

    let nameInputEl = $state<HTMLInputElement | null>(null);
    let draft = $state<State>({
        id: -1, name: '', stateType: 'persistent',
        screenButtons: [], physicalButtons: [],
        onActivate: null, onDeactivate: null,
        buttonFallback: false, activeDevices: [],
    });

    $effect(() => {
        if (open) {
            draft = { ...initialState };
            untrack(() => {
                if (mode === 'create') {
                    tick().then(() => nameInputEl?.focus());
                }
            });
        }
    });

    function handleTypeChange(checked: boolean) {
        draft = { ...draft, stateType: (checked ? 'ephemeral' : 'persistent') as StateType };
    }

    function handleConfirm() {
        onConfirm({ ...draft });
    }
</script>

<Dialog
    open={open}
    onOpenChange={(details) => { if (!details.open) onCancel(); }}
>
    <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
            <Dialog.Content class="card bg-surface-100-900 w-full max-w-sm p-4 space-y-4 shadow-xl">
                <header class="flex justify-between items-center">
                    <Dialog.Title class="text-base font-semibold">
                        {mode === 'create' ? 'Add State' : 'Edit State'}
                    </Dialog.Title>
                </header>

                <div class="flex flex-col gap-3">
                    <input
                        bind:this={nameInputEl}
                        class="input"
                        value={draft.name}
                        oninput={(e: Event) => { draft = { ...draft, name: (e.target as HTMLInputElement).value }; }}
                    />

                    {#if draft.stateType === 'root'}
                        <span class="badge preset-tonal rounded-full self-start">Root</span>
                    {:else}
                        <Switch
                            checked={draft.stateType === 'ephemeral'}
                            onCheckedChange={(details) => handleTypeChange(details.checked)}
                        >
                            <Switch.Control class="switch">
                                <Switch.Thumb class="thumb" />
                            </Switch.Control>
                            <Switch.Label class="text-sm">Ephemeral</Switch.Label>
                            <Switch.HiddenInput />
                        </Switch>
                    {/if}

                    {#if draft.stateType !== 'root'}
                        <Switch
                            checked={draft.buttonFallback}
                            onCheckedChange={(details) => { draft = { ...draft, buttonFallback: details.checked }; }}
                        >
                            <Switch.Control class="switch">
                                <Switch.Thumb class="thumb" />
                            </Switch.Control>
                            <Switch.Label class="text-sm">Button fallback</Switch.Label>
                            <Switch.HiddenInput />
                        </Switch>
                    {/if}

                    {#if draft.stateType === 'persistent'}
                        <div class="flex items-center gap-2">
                            <span class="text-sm font-semibold">On activate</span>
                            <span class="flex-1 text-xs text-surface-500-400">Not configured</span>
                            <button class="btn-icon hover:preset-tonal" disabled>
                                <PencilIcon class="size-4" />
                            </button>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-sm font-semibold">On deactivate</span>
                            <span class="flex-1 text-xs text-surface-500-400">Not configured</span>
                            <button class="btn-icon hover:preset-tonal" disabled>
                                <PencilIcon class="size-4" />
                            </button>
                        </div>
                    {/if}
                </div>

                <footer class="flex justify-end gap-2">
                    <Dialog.CloseTrigger class="btn hover:preset-tonal">Cancel</Dialog.CloseTrigger>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <button class="btn preset-filled-primary-500" onclick={handleConfirm}>
                        {mode === 'create' ? 'Add' : 'Save'}
                    </button>
                </footer>
            </Dialog.Content>
        </Dialog.Positioner>
    </Portal>
</Dialog>
