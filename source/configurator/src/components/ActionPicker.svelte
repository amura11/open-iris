<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/input/input.js';
    import '@shoelace-style/shoelace/dist/components/icon/icon.js';
    import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
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
        kind: 'navigate' | 'pause' | 'power_off_active';
    }

    interface NamedSequenceItem {
        kind: 'named_sequence';
        sequenceId: number;
        name: string;
    }

    type PickerItem = DeviceItem | SystemItem | NamedSequenceItem;

    interface Props {
        devices:          Device[];
        functions:        DeviceFunction[];
        states:           State[];
        mode?:            'single' | 'sequence';
        selectedKey?:     string;
        namedSequences?:  Array<{ sequenceId: number; name: string }>;
        onSelect:         (selection: ActionPickerSelection) => void;
        onSelectNamed?:   (sequenceId: number) => void;
    }

    let { devices, functions, states, mode = 'single', selectedKey, namedSequences = [], onSelect, onSelectNamed }: Props = $props();

    let filterQuery    = $state('');
    let expandedEditor = $state<'navigate' | 'pause' | null>(null);

    const systemItemLabels: Record<'navigate' | 'pause' | 'power_off_active', string> = {
        navigate:         'Navigate',
        pause:            'Pause',
        power_off_active: 'Power off active devices',
    };

    let allItems = $derived.by((): PickerItem[] => {
        const deviceItems: DeviceItem[] = functions.flatMap(fn => {
            const device = devices.find(d => d.id === fn.deviceId);
            if (!device) return [];
            return [{ kind: 'device' as const, device, deviceFunction: fn }];
        });

        const systemItems: SystemItem[] = [
            { kind: 'navigate' },
            { kind: 'pause' },
            { kind: 'power_off_active' },
        ];

        const namedItems: NamedSequenceItem[] = mode === 'single'
            ? namedSequences.map(s => ({ kind: 'named_sequence' as const, sequenceId: s.sequenceId, name: s.name }))
            : [];

        return [...deviceItems, ...systemItems, ...namedItems];
    });

    let visibleItems = $derived.by((): PickerItem[] => {
        const query = filterQuery.trim().toLowerCase();
        if (!query) return allItems;

        return allItems.filter(item => {
            if (item.kind === 'device') {
                return item.deviceFunction.name.toLowerCase().includes(query) ||
                    item.device.name.toLowerCase().includes(query);
            }
            if (item.kind === 'named_sequence') {
                return item.name.toLowerCase().includes(query);
            }
            return systemItemLabels[item.kind].toLowerCase().includes(query);
        });
    });

    function itemLabel(item: PickerItem): string {
        if (item.kind === 'device') return item.deviceFunction.name;
        if (item.kind === 'named_sequence') return item.name;
        return systemItemLabels[item.kind];
    }

    function itemSublabel(item: PickerItem): string {
        if (item.kind === 'device') return item.device.name;
        if (item.kind === 'named_sequence') return 'Saved sequence';
        return 'System';
    }

    function itemKey(item: PickerItem): string {
        if (item.kind === 'device') return `device:${item.device.id}:${item.deviceFunction.id}`;
        if (item.kind === 'named_sequence') return `named:${item.sequenceId}`;
        return `system:${item.kind}`;
    }

    function handleRowClick(item: PickerItem) {
        if (mode !== 'single') return;
        activateItem(item);
    }

    function handlePlusClick(item: PickerItem) {
        activateItem(item);
    }

    function activateItem(item: PickerItem) {
        if (item.kind === 'named_sequence') {
            filterQuery = '';
            onSelectNamed?.(item.sequenceId);
            return;
        }

        if (item.kind === 'device') {
            filterQuery = '';
            onSelect({ kind: 'device', device: item.device, deviceFunction: item.deviceFunction });
            return;
        }

        if (item.kind === 'power_off_active') {
            filterQuery = '';
            onSelect({ kind: 'power_off_active' });
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
                    class="item-row d-flex items-center px-xs py-2xs"
                    class:cursor-pointer={mode === 'single'}
                    class:selected={mode === 'single' && selectedKey === itemKey(item)}
                    class:named-sequence-row={item.kind === 'named_sequence'}
                    onclick={() => handleRowClick(item)}
                >
                    {#if item.kind === 'named_sequence'}
                        <sl-icon name="collection-play" class="text-xs text-muted shrink-0 mr-2xs"></sl-icon>
                    {/if}
                    <span class="text-s flex-1">{itemLabel(item)}</span>
                    <span class="text-xs sublabel">{itemSublabel(item)}</span>
                    {#if mode === 'single'}
                        <sl-icon
                            name="check2"
                            class="check-icon text-s ml-xs"
                            style="visibility: {selectedKey === itemKey(item) ? 'visible' : 'hidden'};"
                        ></sl-icon>
                    {:else}
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <button class="plus-btn ml-xs" onclick={(e) => { e.stopPropagation(); handlePlusClick(item); }}>+</button>
                    {/if}
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

    .item-row.cursor-pointer:hover {
        background: var(--sl-color-neutral-50);
    }

    .item-row.selected {
        background: var(--sl-color-primary-50);
    }

    .named-sequence-row {
        background: color-mix(in srgb, var(--color-accent) 6%, transparent);
    }

    .named-sequence-row:hover {
        background: color-mix(in srgb, var(--color-accent) 12%, transparent) !important;
    }

    .named-sequence-row.selected {
        background: color-mix(in srgb, var(--color-accent) 14%, var(--sl-color-primary-50));
    }

    .sublabel {
        color: var(--color-text-secondary);
    }

    .named-sequence-row .sublabel {
        color: var(--color-accent);
        opacity: 0.85;
    }

    .plus-btn {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 1px solid var(--color-border);
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: var(--color-text-secondary);
        font-size: 14px;
        line-height: 1;
        flex-shrink: 0;
        transition: background-color 0.1s, color 0.1s;
        padding: 0;
        font-family: inherit;
    }

    .plus-btn:hover {
        background: var(--sl-color-primary-100);
        color: var(--color-primary);
        border-color: var(--color-primary);
    }
</style>
