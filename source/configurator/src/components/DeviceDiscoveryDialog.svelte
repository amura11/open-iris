<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
    import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js';
    import '@shoelace-style/shoelace/dist/components/tab/tab.js';
    import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js';
    import '@shoelace-style/shoelace/dist/components/input/input.js';
    import '@shoelace-style/shoelace/dist/components/badge/badge.js';
    import '@shoelace-style/shoelace/dist/components/button/button.js';
    import '@shoelace-style/shoelace/dist/components/icon/icon.js';
    import type SlDialog from '@shoelace-style/shoelace/dist/components/dialog/dialog.component.js';
    import type { Device, DeviceId } from '@model/devices.ts';
    import type { DeviceMetadata } from '@model/state.ts';
    import { HardcodedCatalogSource, type CatalogDevice } from '@catalog/catalog-source.ts';
    import DeviceDetailPanel from './DeviceDetailPanel.svelte';

    interface Props {
        open:             boolean;
        installedDevices: Device[];
        installedMeta:    DeviceMetadata[];
        onAdd:            (device: CatalogDevice) => void;
        onRemove:         (deviceId: DeviceId) => void;
    }

    let { open = $bindable(false), installedDevices, installedMeta, onAdd, onRemove }: Props = $props();

    const catalog = new HardcodedCatalogSource();

    let dialogEl: SlDialog | null = $state(null);
    let browseQuery    = $state('');
    let installedQuery = $state('');
    let selectedDevice = $state<CatalogDevice | null>(null);
    let catalogResults = $state<CatalogDevice[]>([]);

    $effect(() => {
        if (open) {
            dialogEl?.show();
        } else {
            dialogEl?.hide();
        }
    });

    $effect(() => {
        catalog.search(browseQuery).then((results: CatalogDevice[]) => { catalogResults = results; });
    });

    interface InstalledView {
        device:       Device;
        manufacturer: string;
        sourceId:     string | undefined;
    }

    let installedViews = $derived<InstalledView[]>(
        installedDevices.map(device => {
            const meta = installedMeta.find(m => m.id === device.id);
            return { device, manufacturer: meta?.manufacturer ?? '', sourceId: meta?.sourceId };
        })
    );

    const filteredInstalled = $derived(
        installedViews.filter(v => {
            const q = installedQuery.trim().toLowerCase();
            return !q ||
                v.device.name.toLowerCase().includes(q) ||
                v.manufacturer.toLowerCase().includes(q) ||
                v.device.type.toLowerCase().includes(q);
        })
    );

    function isInstalled(sourceId: string): boolean {
        return installedMeta.some(m => m.sourceId === sourceId);
    }

    function handleAdd(device: CatalogDevice) {
        onAdd(device);
        selectedDevice = device;
    }

    function handleRemove(deviceId: DeviceId) {
        const removedMeta = installedMeta.find(m => m.id === deviceId);
        onRemove(deviceId);

        if (removedMeta?.sourceId && selectedDevice?.sourceId === removedMeta.sourceId) {
            selectedDevice = null;
        }
    }

    function handleClose() {
        open = false;
        selectedDevice = null;
    }
</script>

<sl-dialog
    bind:this={dialogEl}
    label="Devices"
    class="device-dialog"
    onsl-after-hide={handleClose}
>
    <div class="d-flex h-full overflow-hidden">
        <!-- ── Left: list pane ── -->
        <div class="list-pane shrink-0 border-right d-flex flex-col overflow-hidden">
            <sl-tab-group>
                <sl-tab slot="nav" panel="browse">Browse</sl-tab>
                <sl-tab slot="nav" panel="installed">
                    Installed
                    {#if installedDevices.length > 0}
                        <sl-badge variant="neutral" pill>{installedDevices.length}</sl-badge>
                    {/if}
                </sl-tab>

                <sl-tab-panel name="browse">
                    <div class="d-flex flex-col h-full overflow-hidden">
                        <div class="py-xs px-s shrink-0 border-bottom">
                            <sl-input
                                class="w-full"
                                placeholder="Search devices…"
                                clearable
                                size="small"
                                value={browseQuery}
                                oninput={(e: Event) => { browseQuery = (e.target as HTMLInputElement).value; }}
                            >
                                <sl-icon slot="prefix" name="search"></sl-icon>
                            </sl-input>
                        </div>
                        <div class="flex-1 overflow-y-auto">
                            {#each catalogResults as device (device.sourceId)}
                                {@const installed = isInstalled(device.sourceId)}
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <!-- svelte-ignore a11y_no_static_element_interactions -->
                                <div
                                    class="device-row d-flex items-center justify-between px-s py-xs gap-xs cursor-pointer border-bottom"
                                    class:selected={selectedDevice?.sourceId === device.sourceId}
                                    onclick={() => { selectedDevice = device; }}
                                >
                                    <div class="d-flex flex-col gap-2xs min-w-0">
                                        <span class="text-s font-semibold truncate">{device.name}</span>
                                        <span class="d-flex items-center gap-2xs text-xs text-muted">
                                            {device.manufacturer}
                                            <sl-badge
                                                variant={device.type === 'ir' ? 'primary' : 'warning'}
                                                pill
                                            >{device.type.toUpperCase()}</sl-badge>
                                            · {device.functions.length} fn
                                        </span>
                                    </div>
                                    {#if installed}
                                        <sl-badge variant="success" pill>Added</sl-badge>
                                    {:else}
                                        <sl-button
                                            size="small"
                                            onclick={(e: Event) => { e.stopPropagation(); handleAdd(device); }}
                                        >Add</sl-button>
                                    {/if}
                                </div>
                            {:else}
                                <div class="p-2xl text-center text-muted text-s">No devices found</div>
                            {/each}
                        </div>
                    </div>
                </sl-tab-panel>

                <sl-tab-panel name="installed">
                    <div class="d-flex flex-col h-full overflow-hidden">
                        <div class="py-xs px-s shrink-0 border-bottom">
                            <sl-input
                                class="w-full"
                                placeholder="Search installed…"
                                clearable
                                size="small"
                                value={installedQuery}
                                oninput={(e: Event) => { installedQuery = (e.target as HTMLInputElement).value; }}
                            >
                                <sl-icon slot="prefix" name="search"></sl-icon>
                            </sl-input>
                        </div>
                        <div class="flex-1 overflow-y-auto">
                            {#each filteredInstalled as view (view.device.id)}
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <!-- svelte-ignore a11y_no_static_element_interactions -->
                                <div
                                    class="device-row d-flex items-center justify-between px-s py-xs gap-xs border-bottom"
                                >
                                    <div class="d-flex flex-col gap-2xs min-w-0">
                                        <span class="text-s font-semibold truncate">{view.device.name}</span>
                                        <span class="d-flex items-center gap-2xs text-xs text-muted">
                                            {view.manufacturer}
                                            <sl-badge
                                                variant={view.device.type === 'ir' ? 'primary' : 'warning'}
                                                pill
                                            >{view.device.type.toUpperCase()}</sl-badge>
                                        </span>
                                    </div>
                                    <sl-button
                                        size="small"
                                        variant="danger"
                                        outline
                                        onclick={(e: Event) => { e.stopPropagation(); handleRemove(view.device.id); }}
                                    >Remove</sl-button>
                                </div>
                            {:else}
                                <div class="p-2xl text-center text-muted text-s">No devices installed</div>
                            {/each}
                        </div>
                    </div>
                </sl-tab-panel>
            </sl-tab-group>
        </div>

        <!-- ── Right: detail pane ── -->
        <div class="flex-1 overflow-hidden d-flex flex-col">
            {#if selectedDevice}
                <DeviceDetailPanel device={selectedDevice} />
            {:else}
                <div class="flex-1 d-flex flex-col items-center justify-center gap-s text-muted text-s">
                    <sl-icon name="cpu" class="text-2xl"></sl-icon>
                    <span>Select a device to see its functions</span>
                </div>
            {/if}
        </div>
    </div>

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <sl-button slot="footer" variant="text" onclick={handleClose}>Close</sl-button>
</sl-dialog>

<style>
    .device-dialog::part(panel) {
        width: min(900px, 92vw);
        height: min(600px, 85vh);
    }

    .device-dialog::part(body) {
        padding: 0;
        overflow: hidden;
    }

    .list-pane {
        width: 340px;
    }

    .list-pane sl-tab-group,
    .list-pane sl-tab-group::part(base) {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
    }

    .list-pane sl-tab-group::part(body) {
        flex: 1;
        overflow: hidden;
    }

    .device-row { transition: background-color 0.1s; }
    .device-row:hover    { background: var(--sl-color-neutral-50); }
    .device-row.selected { background: var(--sl-color-primary-50); }
</style>
