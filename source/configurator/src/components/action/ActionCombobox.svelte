<script lang="ts">
    import { SearchIcon } from '@lucide/svelte';
    import { Combobox, Portal, type ComboboxRootProps, useListCollection } from '@skeletonlabs/skeleton-svelte';
    import type { ActionPickerSelection } from '@model/configurator-types.ts';
    import { configuratorStore } from '@stores/configurator-store.svelte.ts';
    import NavigateActionEditor from './NavigateActionEditor.svelte';
    import PauseActionEditor from './PauseActionEditor.svelte';

    interface ActionItem {
        label:    string;
        value:    string;
        sublabel: string;
    }

    interface Props {
        onSelect: (selection: ActionPickerSelection) => void;
    }

    let { onSelect }: Props = $props();

    let expandedEditor      = $state<'navigate' | 'pause' | null>(null);
    let filteredActionItems = $state<ActionItem[]>([]);
    let comboboxKey         = $state(0);

    let allActionItems = $derived.by((): ActionItem[] => {
        const deviceItems: ActionItem[] = configuratorStore.devices.flatMap(device =>
            device.functions.map(deviceFunction => ({
                label:    deviceFunction.name,
                value:    `device:${device.id}:${deviceFunction.id}`,
                sublabel: device.name,
            }))
        );

        return [
            ...deviceItems,
            { label: 'Navigate',                 value: 'system:navigate',         sublabel: 'System' },
            { label: 'Pause',                    value: 'system:pause',            sublabel: 'System' },
            { label: 'Power off active devices', value: 'system:power_off_active', sublabel: 'System' },
        ];
    });

    // Keep filteredActionItems in sync when the underlying device/function data changes
    $effect(() => {
        filteredActionItems = allActionItems;
    });

    const collection = $derived(
        useListCollection({
            items:        filteredActionItems,
            itemToString: (item) => item.label,
            itemToValue:  (item) => item.value,
        })
    );

    const handleOpenChange: ComboboxRootProps['onOpenChange'] = () => {
        filteredActionItems = allActionItems;
    };

    const handleInputValueChange: ComboboxRootProps['onInputValueChange'] = (event) => {
        const query = event.inputValue.trim().toLowerCase();

        if (!query) {
            filteredActionItems = allActionItems;
            return;
        }

        filteredActionItems = allActionItems.filter(item =>
            item.label.toLowerCase().includes(query) ||
            item.sublabel.toLowerCase().includes(query)
        );
    };

    const handleValueChange: ComboboxRootProps['onValueChange'] = (event) => {
        const key = event.value[0];

        if (!key) {
            return;
        }

        filteredActionItems = allActionItems;
        comboboxKey++;

        if (key === 'system:navigate') {
            expandedEditor = 'navigate';
            return;
        }

        if (key === 'system:pause') {
            expandedEditor = 'pause';
            return;
        }

        if (key === 'system:power_off_active') {
            onSelect({ kind: 'power_off_active' });
            return;
        }

        const parts = key.split(':');

        if (parts[0] === 'device' && parts.length === 3) {
            const deviceId      = Number(parts[1]);
            const functionId    = Number(parts[2]);
            const device        = configuratorStore.devices.find(d => d.id === deviceId);
            const deviceFunction = device?.functions.find(f => f.id === functionId);

            if (device && deviceFunction) {
                onSelect({ kind: 'device', device, deviceFunction });
            }
        }
    };

    function handleNavigateConfirm(targetStateId: number) {
        expandedEditor = null;
        onSelect({ kind: 'navigate', targetStateId });
    }

    function handlePauseConfirm(durationMs: number) {
        expandedEditor = null;
        onSelect({ kind: 'pause', durationMs });
    }

    function handleEditorCancel() {
        expandedEditor = null;
    }
</script>

{#if expandedEditor === 'navigate'}
    <NavigateActionEditor onConfirm={handleNavigateConfirm} onCancel={handleEditorCancel} />
{:else if expandedEditor === 'pause'}
    <PauseActionEditor onConfirm={handlePauseConfirm} onCancel={handleEditorCancel} />
{:else}
    {#key comboboxKey}
        <Combobox
            {collection}
            selectionBehavior="clear"
            openOnClick
            onOpenChange={handleOpenChange}
            onInputValueChange={handleInputValueChange}
            onValueChange={handleValueChange}
        >
            <Combobox.Control class="relative">
                <SearchIcon class="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500-400 pointer-events-none" />
                <Combobox.Input class="input pl-8 text-sm py-1.5" placeholder="Search and add action…" />
            </Combobox.Control>
            <Portal>
                <Combobox.Positioner>
                    <Combobox.Content class="combobox-content">
                        {#if filteredActionItems.length > 0}
                            {#each filteredActionItems as item (item.value)}
                                <Combobox.Item {item} class="combobox-item flex items-center px-2 py-1.5 cursor-pointer">
                                    <Combobox.ItemText class="text-sm flex-1">{item.label}</Combobox.ItemText>
                                    <span class="text-xs text-surface-500-400 ml-2 shrink-0">{item.sublabel}</span>
                                </Combobox.Item>
                            {/each}
                        {:else}
                            <p class="text-sm text-surface-500-400 m-0 px-2 py-2 italic">No actions match.</p>
                        {/if}
                    </Combobox.Content>
                </Combobox.Positioner>
            </Portal>
        </Combobox>
    {/key}
{/if}

<style>
    :global(.combobox-content) {
        border: 1px solid light-dark(var(--color-surface-200), var(--color-surface-700));
        border-radius: var(--radius-base);
        background: light-dark(var(--color-surface-50), var(--color-surface-900));
        overflow-y: auto;
        max-height: 14rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    }

    :global(.combobox-item) {
        border-bottom: 1px solid light-dark(var(--color-surface-200), var(--color-surface-700));
        transition: background-color 0.1s;
    }

    :global(.combobox-item:last-child) {
        border-bottom: none;
    }

    :global(.combobox-item[data-highlighted]) {
        background: light-dark(var(--color-surface-100), var(--color-surface-800));
    }
</style>
