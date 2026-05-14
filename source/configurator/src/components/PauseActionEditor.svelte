<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/input/input.js';
    import '@shoelace-style/shoelace/dist/components/button/button.js';

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

<div class="d-flex flex-col gap-xs">
    <sl-input
        type="number"
        size="small"
        label="Duration (ms)"
        min="1"
        max="65535"
        value={String(durationMs)}
        oninput={(e: Event) => { durationMs = Number((e.target as HTMLInputElement).value); }}
    ></sl-input>
    <div class="d-flex gap-xs justify-end">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <sl-button size="small" variant="text" onclick={onCancel}>Cancel</sl-button>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <sl-button size="small" variant="primary" onclick={handleConfirm}>Confirm</sl-button>
    </div>
</div>
