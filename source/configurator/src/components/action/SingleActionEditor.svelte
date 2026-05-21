<script lang="ts">
    import type { Device, DeviceFunction } from '@model/devices.ts';
    import type { State } from '@model/state.ts';
    import type { ActionPickerSelection } from '@model/configurator-types.ts';
    import ActionPicker from './ActionPicker.svelte';

    interface Props {
        devices:            Device[];
        functions:          DeviceFunction[];
        states:             State[];
        namedSequences:     Array<{ sequenceId: number; name: string }>;
        selectedKey:        string | undefined;
        onSelect:           (selection: ActionPickerSelection) => void;
        onSelectNamed:      (sequenceId: number) => void;
        onTurnIntoSequence: () => void;
    }

    let { devices, functions, states, namedSequences, selectedKey, onSelect, onSelectNamed, onTurnIntoSequence }: Props = $props();
</script>

<div class="flex flex-col">
    <ActionPicker
        {devices}
        {functions}
        {states}
        mode="single"
        {selectedKey}
        {namedSequences}
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
