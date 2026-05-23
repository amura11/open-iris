<script lang="ts">
    import { CpuIcon, SearchIcon, XIcon } from '@lucide/svelte';
    import { Dialog, Portal, Tabs } from '@skeletonlabs/skeleton-svelte';
    import type { Device, DeviceId } from '@model/configurator-types.ts';
    import { HardcodedCatalogSource, type CatalogDevice } from '@catalog/catalog-source.ts';
    import DeviceDetailPanel from './DeviceDetailPanel.svelte';

    interface Props {
        open:             boolean;
        installedDevices: Device[];
        onAdd:            (device: CatalogDevice) => void;
        onRemove:         (deviceId: DeviceId) => void;
    }

    let { open = $bindable(false), installedDevices, onAdd, onRemove }: Props = $props();

    const catalog = new HardcodedCatalogSource();

    let browseQuery    = $state('');
    let installedQuery = $state('');
    let selectedDevice = $state<CatalogDevice | null>(null);
    let catalogResults = $state<CatalogDevice[]>([]);

    $effect(() => {
        catalog.search(browseQuery).then((results: CatalogDevice[]) => { catalogResults = results; });
    });

    const filteredInstalled = $derived(
        installedDevices.filter(device => {
            const q = installedQuery.trim().toLowerCase();
            return !q ||
                device.name.toLowerCase().includes(q) ||
                device.manufacturer.toLowerCase().includes(q) ||
                device.type.toLowerCase().includes(q);
        })
    );

    function isInstalled(sourceId: string): boolean {
        return installedDevices.some(d => d.sourceId === sourceId);
    }

    function handleAdd(device: CatalogDevice) {
        onAdd(device);
        selectedDevice = device;
    }

    function handleRemove(deviceId: DeviceId) {
        const removedDevice = installedDevices.find(d => d.id === deviceId);
        onRemove(deviceId);

        if (removedDevice?.sourceId && selectedDevice?.sourceId === removedDevice.sourceId) {
            selectedDevice = null;
        }
    }

    function handleClose() {
        open = false;
        selectedDevice = null;
    }
</script>

<Dialog
    open={open}
    onOpenChange={(details) => { if (!details.open) handleClose(); }}
>
    <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
            <Dialog.Content class="card bg-surface-100-900 shadow-xl overflow-hidden flex w-[min(900px,92vw)] h-[min(600px,85vh)] p-0">

                <!-- ── Left: list pane ── -->
                <div class="list-pane shrink-0 border-r border-surface-200-800 flex flex-col overflow-hidden">
                    <Tabs defaultValue="browse" class="flex flex-col h-full overflow-hidden">
                        <Tabs.List class="flex shrink-0 border-b border-surface-200-800">
                            <Tabs.Trigger value="browse" class="flex-1 py-2 px-3 text-sm">Browse</Tabs.Trigger>
                            <Tabs.Trigger value="installed" class="flex-1 py-2 px-3 text-sm">
                                Installed
                                {#if installedDevices.length > 0}
                                    <span class="badge preset-tonal rounded-full ml-1">{installedDevices.length}</span>
                                {/if}
                            </Tabs.Trigger>
                        </Tabs.List>

                        <Tabs.Content value="browse" class="flex flex-col flex-1 overflow-hidden">
                            <div class="py-2 px-3 shrink-0 border-b border-surface-200-800">
                                <div class="relative">
                                    <SearchIcon class="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500-400 pointer-events-none" />
                                    <input
                                        class="input pl-8 {browseQuery ? 'pr-8' : ''} w-full"
                                        placeholder="Search devices…"
                                        value={browseQuery}
                                        oninput={(e: Event) => { browseQuery = (e.target as HTMLInputElement).value; }}
                                    />
                                    {#if browseQuery}
                                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                                        <button
                                            class="absolute right-2 top-1/2 -translate-y-1/2 btn-icon hover:preset-tonal size-5"
                                            onclick={() => { browseQuery = ''; }}
                                        >
                                            <XIcon class="size-3" />
                                        </button>
                                    {/if}
                                </div>
                            </div>
                            <div class="flex-1 overflow-y-auto">
                                {#each catalogResults as device (device.sourceId)}
                                    {@const installed = isInstalled(device.sourceId)}
                                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                                    <div
                                        class="device-row flex items-center justify-between px-3 py-2 gap-2 cursor-pointer border-b border-surface-200-800"
                                        class:selected={selectedDevice?.sourceId === device.sourceId}
                                        onclick={() => { selectedDevice = device; }}
                                    >
                                        <div class="flex flex-col gap-1 min-w-0">
                                            <span class="text-sm font-semibold truncate">{device.name}</span>
                                            <span class="flex items-center gap-1 text-xs text-surface-500-400">
                                                {device.manufacturer}
                                                <span class="badge rounded-full {device.type === 'ir' ? 'preset-tonal-primary' : 'preset-tonal-warning'}">
                                                    {device.type.toUpperCase()}
                                                </span>
                                                · {device.functions.length} fn
                                            </span>
                                        </div>
                                        {#if installed}
                                            <span class="badge preset-filled-success-500 rounded-full shrink-0">Added</span>
                                        {:else}
                                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                                            <button
                                                class="btn btn-sm hover:preset-tonal shrink-0"
                                                onclick={(e: Event) => { e.stopPropagation(); handleAdd(device); }}
                                            >Add</button>
                                        {/if}
                                    </div>
                                {:else}
                                    <div class="p-8 text-center text-surface-500-400 text-sm">No devices found</div>
                                {/each}
                            </div>
                        </Tabs.Content>

                        <Tabs.Content value="installed" class="flex flex-col flex-1 overflow-hidden">
                            <div class="py-2 px-3 shrink-0 border-b border-surface-200-800">
                                <div class="relative">
                                    <SearchIcon class="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500-400 pointer-events-none" />
                                    <input
                                        class="input pl-8 {installedQuery ? 'pr-8' : ''} w-full"
                                        placeholder="Search installed…"
                                        value={installedQuery}
                                        oninput={(e: Event) => { installedQuery = (e.target as HTMLInputElement).value; }}
                                    />
                                    {#if installedQuery}
                                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                                        <button
                                            class="absolute right-2 top-1/2 -translate-y-1/2 btn-icon hover:preset-tonal size-5"
                                            onclick={() => { installedQuery = ''; }}
                                        >
                                            <XIcon class="size-3" />
                                        </button>
                                    {/if}
                                </div>
                            </div>
                            <div class="flex-1 overflow-y-auto">
                                {#each filteredInstalled as device (device.id)}
                                    <div class="device-row flex items-center justify-between px-3 py-2 gap-2 border-b border-surface-200-800">
                                        <div class="flex flex-col gap-1 min-w-0">
                                            <span class="text-sm font-semibold truncate">{device.name}</span>
                                            <span class="flex items-center gap-1 text-xs text-surface-500-400">
                                                {device.manufacturer}
                                                <span class="badge rounded-full {device.type === 'ir' ? 'preset-tonal-primary' : 'preset-tonal-warning'}">
                                                    {device.type.toUpperCase()}
                                                </span>
                                            </span>
                                        </div>
                                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                                        <button
                                            class="btn btn-sm preset-outlined-error-500 shrink-0"
                                            onclick={(e: Event) => { e.stopPropagation(); handleRemove(device.id); }}
                                        >Remove</button>
                                    </div>
                                {:else}
                                    <div class="p-8 text-center text-surface-500-400 text-sm">No devices installed</div>
                                {/each}
                            </div>
                        </Tabs.Content>
                    </Tabs>
                </div>

                <!-- ── Right: detail pane ── -->
                <div class="flex-1 overflow-hidden flex flex-col">
                    {#if selectedDevice}
                        <DeviceDetailPanel device={selectedDevice} />
                    {:else}
                        <div class="flex-1 flex flex-col items-center justify-center gap-3 text-surface-500-400 text-sm">
                            <CpuIcon class="size-8 opacity-40" />
                            <span>Select a device to see its functions</span>
                        </div>
                    {/if}
                </div>

                <!-- Close button in bottom-right corner -->
                <div class="absolute bottom-3 right-3">
                    <Dialog.CloseTrigger class="btn btn-sm hover:preset-tonal">Close</Dialog.CloseTrigger>
                </div>

            </Dialog.Content>
        </Dialog.Positioner>
    </Portal>
</Dialog>

<style>
    .list-pane { width: 340px; }

    .device-row { transition: background-color 0.1s; }
    .device-row:hover    { background: light-dark(var(--color-surface-100), var(--color-surface-800)); }
    .device-row.selected { background: light-dark(var(--color-primary-50), var(--color-primary-950)); }
</style>
