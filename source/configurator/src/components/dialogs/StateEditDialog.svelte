<script lang="ts">
    import { InfoIcon, PencilIcon, XIcon } from '@lucide/svelte';
    import { Combobox, Dialog, Portal, Switch, Tooltip, type ComboboxRootProps, useListCollection } from '@skeletonlabs/skeleton-svelte';
    import { tick, untrack } from 'svelte';
    import type { Device, DeviceId, State, StateType } from '@model/configurator-types.ts';

    interface DeviceItem {
        label: string;
        value: string;
    }

    interface Props {
        open:         boolean;
        mode:         'create' | 'edit';
        initialState: State;
        devices:      Device[];
        onConfirm:    (state: State) => void;
        onCancel:     () => void;
    }

    let { open, mode, initialState, devices, onConfirm, onCancel }: Props = $props();

    let nameInputEl = $state<HTMLInputElement | null>(null);
    let draft = $state<State>({
        id: -1, name: '', stateType: 'persistent',
        screenButtons: [], physicalButtons: [],
        onActivate: null, onDeactivate: null,
        buttonFallback: false, activeDevices: [],
    });

    let allDeviceItems = $derived<DeviceItem[]>(devices.map(device => ({ label: device.name, value: String(device.id) })));
    let filteredDeviceItems = $state<DeviceItem[]>([]);

    $effect(() => {
        filteredDeviceItems = allDeviceItems;
    });

    const deviceCollection = $derived(
        useListCollection({
            items:        filteredDeviceItems,
            itemToString: (item) => item.label,
            itemToValue:  (item) => item.value,
        })
    );

    let selectedDevices = $derived(
        draft.activeDevices
            .map(id => devices.find(d => d.id === id))
            .filter((d): d is Device => d !== undefined)
    );

    let comboboxValue = $derived(draft.activeDevices.map(String));

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
        draft = { ...draft, stateType: (checked ? 'persistent' : 'ephemeral') as StateType };
    }

    function handleDeviceOpenChange() {
        filteredDeviceItems = allDeviceItems;
    }

    const handleDeviceInputValueChange: ComboboxRootProps['onInputValueChange'] = (event) => {
        const query = event.inputValue.trim().toLowerCase();

        if (!query) {
            filteredDeviceItems = allDeviceItems;
            return;
        }

        filteredDeviceItems = allDeviceItems.filter(item => item.label.toLowerCase().includes(query));
    };

    const handleDeviceValueChange: ComboboxRootProps['onValueChange'] = (event) => {
        draft = { ...draft, activeDevices: event.value.map(Number) as DeviceId[] };
    };

    function removeDevice(deviceId: DeviceId) {
        draft = { ...draft, activeDevices: draft.activeDevices.filter(id => id !== deviceId) };
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
                        <div class="flex items-center gap-2">
                            <Switch
                                checked={draft.stateType === 'persistent'}
                                onCheckedChange={(details) => handleTypeChange(details.checked)}
                            >
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                                <Switch.Label class="text-sm">Persistent</Switch.Label>
                                <Switch.HiddenInput />
                            </Switch>
                            <Tooltip positioning={{ placement: 'right' }}>
                                <Tooltip.Trigger class="btn-icon hover:preset-tonal size-5">
                                    <InfoIcon class="size-4 text-surface-500-400" />
                                </Tooltip.Trigger>
                                <Portal>
                                    <Tooltip.Positioner class="z-[60]!">
                                        <Tooltip.Content class="card bg-surface-100-900 p-3 shadow-xl text-sm max-w-56">
                                            Persistent states remain active until you explicitly switch away. Ephemeral states automatically return to the previous state when deactivated.
                                        </Tooltip.Content>
                                    </Tooltip.Positioner>
                                </Portal>
                            </Tooltip>
                        </div>
                    {/if}

                    {#if draft.stateType === 'ephemeral'}
                        <div class="flex items-center gap-2">
                            <Switch
                                checked={draft.buttonFallback}
                                onCheckedChange={(details) => { draft = { ...draft, buttonFallback: details.checked }; }}
                            >
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                                <Switch.Label class="text-sm">Button fallback</Switch.Label>
                                <Switch.HiddenInput />
                            </Switch>
                            <Tooltip positioning={{ placement: 'right' }}>
                                <Tooltip.Trigger class="btn-icon hover:preset-tonal size-5">
                                    <InfoIcon class="size-4 text-surface-500-400" />
                                </Tooltip.Trigger>
                                <Portal>
                                    <Tooltip.Positioner class="z-[60]!">
                                        <Tooltip.Content class="card bg-surface-100-900 p-3 shadow-xl text-sm max-w-56">
                                            When enabled, buttons without a configured action in this state will use the action from the root state instead.
                                        </Tooltip.Content>
                                    </Tooltip.Positioner>
                                </Portal>
                            </Tooltip>
                        </div>
                    {/if}

                    {#if draft.stateType === 'persistent'}
                        <div class="flex flex-col gap-2">
                            <span class="text-sm font-semibold">Active devices</span>

                            {#if devices.length === 0}
                                <p class="text-xs text-surface-500-400 italic">No devices configured.</p>
                            {:else}
                                <Combobox
                                    value={comboboxValue}
                                    collection={deviceCollection}
                                    multiple
                                    selectionBehavior="preserve"
                                    onOpenChange={handleDeviceOpenChange}
                                    onInputValueChange={handleDeviceInputValueChange}
                                    onValueChange={handleDeviceValueChange}
                                >
                                    <Combobox.Control>
                                        <Combobox.Input class="input text-sm" placeholder="Search devices…" />
                                        <Combobox.Trigger />
                                    </Combobox.Control>
                                    <Portal>
                                        <Combobox.Positioner class="z-[60]!">
                                            <Combobox.Content class="combobox-content">
                                                {#if filteredDeviceItems.length > 0}
                                                    {#each filteredDeviceItems as item (item.value)}
                                                        <Combobox.Item {item} class="combobox-item flex items-center px-2 py-1.5 cursor-pointer">
                                                            <Combobox.ItemText class="text-sm flex-1">{item.label}</Combobox.ItemText>
                                                            <Combobox.ItemIndicator />
                                                        </Combobox.Item>
                                                    {/each}
                                                {:else}
                                                    <p class="text-sm text-surface-500-400 m-0 px-2 py-2 italic">No devices match.</p>
                                                {/if}
                                            </Combobox.Content>
                                        </Combobox.Positioner>
                                    </Portal>
                                </Combobox>

                                {#if selectedDevices.length > 0}
                                    <div class="flex flex-wrap gap-1.5">
                                        {#each selectedDevices as device (device.id)}
                                            <span class="badge preset-tonal rounded-full flex items-center gap-1 pr-1">
                                                {device.name}
                                                <button
                                                    class="btn-icon size-4 hover:preset-tonal rounded-full"
                                                    onclick={() => removeDevice(device.id)}
                                                >
                                                    <XIcon class="size-3" />
                                                </button>
                                            </span>
                                        {/each}
                                    </div>
                                {/if}
                            {/if}
                        </div>

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
