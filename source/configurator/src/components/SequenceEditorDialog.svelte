<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
    import '@shoelace-style/shoelace/dist/components/button/button.js';
    import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
    import '@shoelace-style/shoelace/dist/components/switch/switch.js';
    import '@shoelace-style/shoelace/dist/components/input/input.js';
    import type SlDialog from '@shoelace-style/shoelace/dist/components/dialog/dialog.component.js';
    import type { Device, DeviceFunction } from '@model/devices.ts';
    import type { State } from '@model/state.ts';
    import { untrack } from 'svelte';
    import type { ActionPickerSelection, SequenceEditorConfirmation } from '@model/configurator-types.ts';
    import ActionPicker from './ActionPicker.svelte';

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

    let dialogEl: SlDialog | null = $state(null);
    let steps = $state<ActionPickerSelection[]>([]);
    let saveAsReusable = $state(false);
    let sequenceName = $state('');
    let delayMs = $state(200);
    let pickerKey = $state(0);
    // Tracks whether the user's action (confirm or cancel button) was already handled,
    // so onsl-after-hide only fires onCancel for Escape / X-button closes.
    let justHandled = false;

    $effect(() => {
        if (open) {
            steps = initialSteps ? [...initialSteps] : [];
            sequenceName = initialName ?? '';
            saveAsReusable = !!initialName;
            delayMs = initialDelayMs ?? 200;
            untrack(() => { pickerKey++; });
            dialogEl?.show();
        } else {
            dialogEl?.hide();
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
        justHandled = true;
        onConfirm({
            steps,
            name: saveAsReusable && sequenceName.trim() ? sequenceName.trim() : undefined,
            delayMs,
        });
        dialogEl?.hide();
    }

    function handleCancelClick() {
        justHandled = true;
        onCancel();
        dialogEl?.hide();
    }

    function handleAfterHide() {
        if (!justHandled) {
            onCancel();
        }
        justHandled = false;
    }
</script>

<sl-dialog
    bind:this={dialogEl}
    label="Multi-action sequence"
    class="sequence-dialog"
    onsl-after-hide={handleAfterHide}
>
    <div class="d-flex h-full overflow-hidden">

        <!-- ── Left: sequence steps ───────────────────────────────────────── -->
        <div class="steps-panel d-flex flex-col border-right overflow-hidden shrink-0">

            <!-- Naming + delay settings -->
            <div class="p-m border-bottom shrink-0">
                <sl-switch
                    checked={saveAsReusable}
                    onsl-change={(e: Event) => { saveAsReusable = (e.target as HTMLInputElement).checked; }}
                >Save as reusable</sl-switch>

                {#if saveAsReusable}
                    <sl-input
                        class="mt-s"
                        size="small"
                        placeholder="Sequence name…"
                        value={sequenceName}
                        oninput={(e: Event) => { sequenceName = (e.target as HTMLInputElement).value; }}
                    ></sl-input>
                {/if}

                <sl-input
                    class="mt-s"
                    size="small"
                    label="Delay between steps"
                    type="number"
                    value={String(delayMs)}
                    min="0"
                    step="50"
                    oninput={(e: Event) => {
                        const n = parseInt((e.target as HTMLInputElement).value, 10);
                        delayMs = isNaN(n) ? 200 : Math.max(0, n);
                    }}
                >
                    <span slot="suffix" class="text-xs text-muted">ms</span>
                </sl-input>
            </div>

            <!-- Step list -->
            <div class="flex-1 overflow-y-auto p-m d-flex flex-col gap-2xs">
                {#if steps.length > 0}
                    {#each steps as step, index (index)}
                        <div class="step-row d-flex items-center gap-2xs px-xs py-2xs rounded-s">
                            <span class="step-index text-xs text-muted shrink-0">{index + 1}</span>
                            <span class="text-s flex-1 min-w-0 truncate">{stepLabel(step)}</span>
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <sl-icon-button
                                name="arrow-up"
                                label="Move up"
                                disabled={index === 0}
                                onclick={() => handleMoveUp(index)}
                            ></sl-icon-button>
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <sl-icon-button
                                name="arrow-down"
                                label="Move down"
                                disabled={index === steps.length - 1}
                                onclick={() => handleMoveDown(index)}
                            ></sl-icon-button>
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <sl-icon-button
                                name="trash"
                                label="Remove"
                                onclick={() => handleRemoveStep(index)}
                            ></sl-icon-button>
                        </div>
                    {/each}
                {:else}
                    <p class="text-s text-muted m-0 text-center mt-m">No actions yet.<br>Pick one from the right.</p>
                {/if}
            </div>
        </div>

        <!-- ── Right: action picker ───────────────────────────────────────── -->
        <div class="picker-panel flex-1 overflow-y-auto p-m">
            {#key pickerKey}
                <ActionPicker {devices} {functions} {states} onSelect={handleAddStep} />
            {/key}
        </div>

    </div>

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <sl-button slot="footer" variant="text" onclick={handleCancelClick}>Cancel</sl-button>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <sl-button slot="footer" variant="primary" disabled={steps.length < 2} onclick={handleConfirm}>Confirm</sl-button>
</sl-dialog>

<style>
    .sequence-dialog::part(panel) {
        width: min(760px, 92vw);
        height: min(520px, 85vh);
    }

    .sequence-dialog::part(body) {
        padding: 0;
        overflow: hidden;
    }

    .steps-panel {
        width: 320px;
    }

    .step-row {
        border: 1px solid var(--color-border);
    }

    .step-index {
        min-width: 1rem;
        text-align: right;
    }
</style>
