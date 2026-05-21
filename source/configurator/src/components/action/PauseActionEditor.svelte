<script lang="ts">
    interface Props {
        onConfirm: (durationMs: number) => void;
        onCancel: () => void;
    }

    let { onConfirm, onCancel }: Props = $props();

    let durationMs = $state(500);

    function handleConfirm() {
        const clamped = Math.max(1, Math.min(65535, Math.round(durationMs)));
        onConfirm(clamped);
    }
</script>

<div class="flex flex-col gap-2">
    <label class="label">
        <span class="label-text">Duration (ms)</span>
        <input
            class="input"
            type="number"
            min="1"
            max="65535"
            value={String(durationMs)}
            oninput={(e: Event) => { durationMs = Number((e.target as HTMLInputElement).value); }}
        />
    </label>
    <div class="flex gap-2 justify-end">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <button class="btn btn-sm hover:preset-tonal" onclick={onCancel}>Cancel</button>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <button class="btn btn-sm preset-filled-primary-500" onclick={handleConfirm}>Confirm</button>
    </div>
</div>
