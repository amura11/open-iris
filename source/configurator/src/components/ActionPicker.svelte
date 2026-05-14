<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/input/input.js';
    import '@shoelace-style/shoelace/dist/components/icon/icon.js';
    import type { Device, DeviceFunction } from '@model/devices.ts';
    import type { State } from '@model/state.ts';
    import type { ActionPickerSelection } from '@model/configurator-types.ts';
    import NavigateActionEditor from './NavigateActionEditor.svelte';
    import PauseActionEditor from './PauseActionEditor.svelte';

    interface DeviceItem {
        kind: 'device';
        device: Device;
        deviceFunction: DeviceFunction;
    }

    interface SystemItem {
        kind: 'navigate' | 'pause';
    }

    type PickerItem = DeviceItem | SystemItem;

    interface Props {
        devices: Device[];
        states: State[];
        onSelect: (selection: ActionPickerSelection) => void;
    }

    let { devices, states, onSelect }: Props = $props();

    let filterQuery = $state('');
    let expandedEditor = $state<'navigate' | 'pause' | null>(null);

    const systemItemLabels: Record<'navigate' | 'pause', string> = {
        navigate: 'Navigate',
        pause: 'Pause',
    };

    let allItems = $derived.by((): PickerItem[] => {
        const deviceItems: DeviceItem[] = devices.flatMap(device =>
            device.functions.map(deviceFunction => ({ kind: 'device' as const, device, deviceFunction }))
        );

        const systemItems: SystemItem[] = [{ kind: 'navigate' }, { kind: 'pause' }];

        return [...deviceItems, ...systemItems];
    });

    let visibleItems = $derived.by((): PickerItem[] => {
        const query = filterQuery.trim().toLowerCase();

        if (!query) {
            return allItems;
        }

        return allItems.filter(item => {
            if (item.kind === 'device') {
                return item.deviceFunction.name.toLowerCase().includes(query) ||
                    item.device.name.toLowerCase().includes(query);
            }

            return systemItemLabels[item.kind].toLowerCase().includes(query);
        });
    });

    function itemLabel(item: PickerItem): string {
        if (item.kind === 'device') {
            return item.deviceFunction.name;
        }

        return systemItemLabels[item.kind];
    }

    function itemSublabel(item: PickerItem): string {
        if (item.kind === 'device') {
            return item.device.name;
        }

        return 'System';
    }

    function itemKey(item: PickerItem): string {
        if (item.kind === 'device') {
            return `device:${item.device.id}:${item.deviceFunction.name}`;
        }

        return `system:${item.kind}`;
    }

    function handleItemClick(item: PickerItem) {
        if (item.kind === 'device') {
            filterQuery = '';
            onSelect({ kind: 'device', device: item.device, deviceFunction: item.deviceFunction });
            return;
        }

        expandedEditor = item.kind;
    }

    function handleNavigateConfirm(targetStateId: number) {
        expandedEditor = null;
        filterQuery = '';
        onSelect({ kind: 'navigate', targetStateId });
    }

    function handlePauseConfirm(durationMs: number) {
        expandedEditor = null;
        filterQuery = '';
        onSelect({ kind: 'pause', durationMs });
    }

    function handleEditorCancel() {
        expandedEditor = null;
    }
</script>

<div class="d-flex flex-col gap-xs">
    <sl-input
        size="small"
        placeholder="Search actions…"
        clearable
        disabled={expandedEditor !== null}
        value={filterQuery}
        oninput={(e: Event) => { filterQuery = (e.target as HTMLInputElement).value; }}
        onsl-clear={() => { filterQuery = ''; }}
    >
        <sl-icon slot="prefix" name="search"></sl-icon>
    </sl-input>

    {#if expandedEditor === 'navigate'}
        <NavigateActionEditor {states} onConfirm={handleNavigateConfirm} onCancel={handleEditorCancel} />
    {:else if expandedEditor === 'pause'}
        <PauseActionEditor onConfirm={handlePauseConfirm} onCancel={handleEditorCancel} />
    {:else if visibleItems.length > 0}
        <div class="items-list">
            {#each visibleItems as item (itemKey(item))}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="item-row d-flex items-center justify-between px-xs py-2xs cursor-pointer"
                    onclick={() => handleItemClick(item)}
                >
                    <span class="text-s">{itemLabel(item)}</span>
                    <span class="text-xs text-muted">{itemSublabel(item)}</span>
                </div>
            {/each}
        </div>
    {:else}
        <p class="text-s text-muted m-0">No actions match &ldquo;{filterQuery.trim()}&rdquo;.</p>
    {/if}
</div>

<style>
    .items-list {
        border: 1px solid var(--color-border);
        border-radius: var(--sl-border-radius-medium);
        overflow-y: auto;
        max-height: 16rem;
    }

    .item-row {
        border-bottom: 1px solid var(--color-border);
        transition: background-color 0.1s;
    }

    .item-row:last-child {
        border-bottom: none;
    }

    .item-row:hover {
        background: var(--sl-color-neutral-50);
    }
</style>
