<script lang="ts">
    import type { ActionPickerSelection } from '@model/configurator-types.ts';
    import ActionPicker from './ActionPicker.svelte';

    interface Props {
        selectedKey:        string | undefined;
        onSelect:           (selection: ActionPickerSelection) => void;
        onSelectNamed:      (sequenceId: number) => void;
        onTurnIntoSequence: () => void;
    }

    let { selectedKey, onSelect, onSelectNamed, onTurnIntoSequence }: Props = $props();
</script>

<div class="flex flex-col">
    <ActionPicker
        mode="single"
        {selectedKey}
        {onSelect}
        {onSelectNamed}
    />
    <div class="flex items-center border-t border-surface-200-800 mt-2 pt-2">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <button class="btn btn-sm hover:preset-tonal" onclick={onTurnIntoSequence}>
            + Turn into sequence
        </button>
    </div>
</div>
