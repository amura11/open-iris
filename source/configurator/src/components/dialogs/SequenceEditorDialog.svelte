<script lang="ts">
    import { ArrowUpIcon, ArrowDownIcon, Trash2Icon } from '@lucide/svelte';
    import { Dialog, Portal, Switch } from '@skeletonlabs/skeleton-svelte';
    import { untrack } from 'svelte';
    import type { Device, DeviceFunction } from '@model/devices.ts';
    import type { State } from '@model/state.ts';
    import type { ActionPickerSelection, SequenceEditorConfirmation } from '@model/configurator-types.ts';
    import ActionPicker from '@components/action/ActionPicker.svelte';

    interface Props {
        open:           boolean;
        devices:        Device[];
        functions:      DeviceFunction[];
        states:         State[];
        initialSteps?:  ActionPickerSelection[];
        initialName?:   string;
        initialDelayMs?: number;
        onConfirm:      (result: SequenceEditorConfirmation) => void;
        onCancel:       () => void;
    }

    let { open, devices, functions, states, initialSteps, initialName, initialDelayMs, onConfirm, onCancel }: Props = $props();

    let steps = $state<ActionPickerSelection[]>([]);
    let saveAsReusable = $state(false);
    let sequenceName = $state('');
    let delayMs = $state(200);
    let pickerKey = $state(0);

    $effect(() => {
        if (open) {
            steps = initialSteps ? [...initialSteps] : [];
            sequenceName = initialName ?? '';
            saveAsReusable = !!initialName;
            delayMs = initialDelayMs ?? 200;
            untrack(() => { pickerKey++; });
        }
    });

    function stepLabel(selection: ActionPickerSelection): string {
        if (selection.kind === 'device') {
            return `${selection.device.name} → ${selection.deviceFunction.name}`;
        }
        if (selection.kind === 'navigate') {
            const targetState = states.find(s => s.id === selection.targetStateId);
            return `Navigate → ${targetState?.name ?? 'Unknown'}`;
        }
        if (selection.kind === 'pause') {
            return `Pause ${selection.durationMs}ms`;
        }
        return 'Power off active devices';
    }

    function handleAddStep(selection: ActionPickerSelection) {
        steps = [...steps, selection];
        pickerKey++;
    }

    function handleMoveUp(index: number) {
        if (index === 0) return;
        const updated = [...steps];
        [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
        steps = updated;
    }

    function handleMoveDown(index: number) {
        if (index === steps.length - 1) return;
        const updated = [...steps];
        [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
        steps = updated;
    }

    function handleRemoveStep(index: number) {
        steps = steps.filter((_, i) => i !== index);
    }

    function handleConfirm() {
        onConfirm({
            steps,
            name: saveAsReusable && sequenceName.trim() ? sequenceName.trim() : undefined,
            delayMs,
        });
    }
</script>

<Dialog
    open={open}
    onOpenChange={(details) => { if (!details.open) onCancel(); }}
>
    <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
            <Dialog.Content class="card bg-surface-100-900 shadow-xl overflow-hidden flex flex-col w-[min(760px,92vw)] h-[min(520px,85vh)] p-0">

                <div class="flex flex-1 overflow-hidden">

                    <!-- ── Left: sequence steps ───────────────────────────────────────── -->
                    <div class="steps-panel flex flex-col border-r border-surface-200-800 overflow-hidden shrink-0">

                        <div class="p-4 border-b border-surface-200-800 shrink-0 flex flex-col gap-3">
                            <Switch
                                checked={saveAsReusable}
                                onCheckedChange={(details) => { saveAsReusable = details.checked; }}
                            >
                                <Switch.Control class="switch">
                                    <Switch.Thumb class="thumb" />
                                </Switch.Control>
                                <Switch.Label class="text-sm">Save as reusable</Switch.Label>
                                <Switch.HiddenInput />
                            </Switch>

                            {#if saveAsReusable}
                                <input
                                    class="input"
                                    placeholder="Sequence name…"
                                    value={sequenceName}
                                    oninput={(e: Event) => { sequenceName = (e.target as HTMLInputElement).value; }}
                                />
                            {/if}

                            <label class="label">
                                <span class="label-text">Delay between steps</span>
                                <div class="input-group">
                                    <input
                                        class="ig-input"
                                        type="number"
                                        value={String(delayMs)}
                                        min="0"
                                        step="50"
                                        oninput={(e: Event) => {
                                            const n = parseInt((e.target as HTMLInputElement).value, 10);
                                            delayMs = isNaN(n) ? 200 : Math.max(0, n);
                                        }}
                                    />
                                    <div class="ig-cell text-xs text-surface-500-400">ms</div>
                                </div>
                            </label>
                        </div>

                        <!-- Step list -->
                        <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
                            {#if steps.length > 0}
                                {#each steps as step, index (index)}
                                    <div class="step-row flex items-center gap-1 px-2 py-1 rounded">
                                        <span class="step-index text-xs text-surface-500-400 shrink-0">{index + 1}</span>
                                        <span class="text-sm flex-1 min-w-0 truncate">{stepLabel(step)}</span>
                                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                                        <button
                                            class="btn-icon hover:preset-tonal"
                                            title="Move up"
                                            disabled={index === 0}
                                            onclick={() => handleMoveUp(index)}
                                        >
                                            <ArrowUpIcon class="size-3" />
                                        </button>
                                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                                        <button
                                            class="btn-icon hover:preset-tonal"
                                            title="Move down"
                                            disabled={index === steps.length - 1}
                                            onclick={() => handleMoveDown(index)}
                                        >
                                            <ArrowDownIcon class="size-3" />
                                        </button>
                                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                                        <button
                                            class="btn-icon hover:preset-tonal"
                                            title="Remove"
                                            onclick={() => handleRemoveStep(index)}
                                        >
                                            <Trash2Icon class="size-3" />
                                        </button>
                                    </div>
                                {/each}
                            {:else}
                                <p class="text-sm text-surface-500-400 m-0 text-center mt-4">No actions yet.<br>Pick one from the right.</p>
                            {/if}
                        </div>
                    </div>

                    <!-- ── Right: action picker ───────────────────────────────────────── -->
                    <div class="flex-1 overflow-y-auto p-4">
                        {#key pickerKey}
                            <ActionPicker {devices} {functions} {states} onSelect={handleAddStep} />
                        {/key}
                    </div>

                </div>

                <footer class="flex justify-end gap-2 p-3 border-t border-surface-200-800 shrink-0">
                    <Dialog.CloseTrigger class="btn hover:preset-tonal">Cancel</Dialog.CloseTrigger>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <button
                        class="btn preset-filled-primary-500"
                        disabled={steps.length < 2}
                        onclick={handleConfirm}
                    >Confirm</button>
                </footer>

            </Dialog.Content>
        </Dialog.Positioner>
    </Portal>
</Dialog>

<style>
    .steps-panel { width: 320px; }

    .step-row {
        border: 1px solid light-dark(var(--color-surface-200), var(--color-surface-700));
    }

    .step-index {
        min-width: 1rem;
        text-align: right;
    }
</style>
