<script lang="ts">
    import { SearchIcon, CheckIcon, ListVideoIcon, XIcon } from '@lucide/svelte';
    import type { ActionPickerSelection } from '@model/configurator-types.ts';
    import { configuratorStore } from '@stores/configurator-store.svelte.ts';
    import NavigateActionEditor from './NavigateActionEditor.svelte';
    import PauseActionEditor from './PauseActionEditor.svelte';

    interface DeviceItem {
        kind: 'device';
        device: import('@model/configurator-types.ts').Device;
        deviceFunction: import('@model/configurator-types.ts').DeviceFunction;
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
        mode?:          'single' | 'sequence';
        selectedKey?:   string;
        onSelect:       (selection: ActionPickerSelection) => void;
        onSelectNamed?: (sequenceId: number) => void;
    }

    let { mode = 'single', selectedKey, onSelect, onSelectNamed }: Props = $props();

    let filterQuery    = $state('');
    let expandedEditor = $state<'navigate' | 'pause' | null>(null);

    const systemItemLabels: Record<'navigate' | 'pause' | 'power_off_active', string> = {
        navigate:         'Navigate',
        pause:            'Pause',
        power_off_active: 'Power off active devices',
    };

    let allItems = $derived.by((): PickerItem[] => {
        const deviceItems: DeviceItem[] = configuratorStore.devices.flatMap(device =>
            device.functions.map(deviceFunction => ({
                kind: 'device' as const,
                device,
                deviceFunction,
            }))
        );

        const systemItems: SystemItem[] = [
            { kind: 'navigate' },
            { kind: 'pause' },
            { kind: 'power_off_active' },
        ];

        const namedItems: NamedSequenceItem[] = mode === 'single'
            ? configuratorStore.sequences
                .filter(s => s.name !== undefined)
                .map(s => ({ kind: 'named_sequence' as const, sequenceId: s.id, name: s.name! }))
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

<div class="flex flex-col gap-2">
    <div class="relative">
        <SearchIcon class="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500-400 pointer-events-none" />
        <input
            class="input pl-8 {filterQuery ? 'pr-8' : ''}"
            placeholder="Search actions…"
            disabled={expandedEditor !== null}
            value={filterQuery}
            oninput={(e: Event) => { filterQuery = (e.target as HTMLInputElement).value; }}
        />
        {#if filterQuery}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button
                class="absolute right-2 top-1/2 -translate-y-1/2 btn-icon hover:preset-tonal size-5"
                onclick={() => { filterQuery = ''; }}
            >
                <XIcon class="size-3" />
            </button>
        {/if}
    </div>

    {#if expandedEditor === 'navigate'}
        <NavigateActionEditor onConfirm={handleNavigateConfirm} onCancel={handleEditorCancel} />
    {:else if expandedEditor === 'pause'}
        <PauseActionEditor onConfirm={handlePauseConfirm} onCancel={handleEditorCancel} />
    {:else if visibleItems.length > 0}
        <div class="items-list">
            {#each visibleItems as item (itemKey(item))}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="item-row flex items-center px-2 py-1"
                    class:cursor-pointer={mode === 'single'}
                    class:selected={mode === 'single' && selectedKey === itemKey(item)}
                    class:named-sequence-row={item.kind === 'named_sequence'}
                    onclick={() => handleRowClick(item)}
                >
                    {#if item.kind === 'named_sequence'}
                        <ListVideoIcon class="size-3 opacity-40 shrink-0 mr-1" />
                    {/if}
                    <span class="text-sm flex-1">{itemLabel(item)}</span>
                    <span class="text-xs sublabel">{itemSublabel(item)}</span>
                    {#if mode === 'single'}
                        <CheckIcon
                            class="size-4 ml-2"
                            style="visibility: {selectedKey === itemKey(item) ? 'visible' : 'hidden'};"
                        />
                    {:else}
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <button class="plus-btn ml-2" onclick={(e) => { e.stopPropagation(); handlePlusClick(item); }}>+</button>
                    {/if}
                </div>
            {/each}
        </div>
    {:else}
        <p class="text-sm text-surface-500-400 m-0">No actions match &ldquo;{filterQuery.trim()}&rdquo;.</p>
    {/if}
</div>

<style>
    .items-list {
        border: 1px solid light-dark(var(--color-surface-200), var(--color-surface-700));
        border-radius: var(--radius-base);
        overflow-y: auto;
        max-height: 16rem;
    }

    .item-row {
        border-bottom: 1px solid light-dark(var(--color-surface-200), var(--color-surface-700));
        transition: background-color 0.1s;
    }

    .item-row:last-child { border-bottom: none; }

    .item-row.cursor-pointer:hover {
        background: light-dark(var(--color-surface-100), var(--color-surface-800));
    }

    .item-row.selected {
        background: light-dark(var(--color-primary-50), var(--color-primary-950));
    }

    .named-sequence-row {
        background: color-mix(in srgb, var(--color-tertiary-500) 6%, transparent);
    }

    .named-sequence-row:hover {
        background: color-mix(in srgb, var(--color-tertiary-500) 12%, transparent) !important;
    }

    .named-sequence-row.selected {
        background: color-mix(in srgb, var(--color-tertiary-500) 14%, light-dark(var(--color-primary-50), var(--color-primary-950)));
    }

    .sublabel {
        color: light-dark(var(--color-surface-600), var(--color-surface-400));
    }

    .named-sequence-row .sublabel {
        color: var(--color-tertiary-500);
        opacity: 0.85;
    }

    .plus-btn {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 1px solid light-dark(var(--color-surface-300), var(--color-surface-600));
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: light-dark(var(--color-surface-600), var(--color-surface-400));
        font-size: 14px;
        line-height: 1;
        flex-shrink: 0;
        transition: background-color 0.1s, color 0.1s;
        padding: 0;
        font-family: inherit;
    }

    .plus-btn:hover {
        background: light-dark(var(--color-primary-100), var(--color-primary-900));
        color: var(--color-primary-600);
        border-color: var(--color-primary-600);
    }
</style>
