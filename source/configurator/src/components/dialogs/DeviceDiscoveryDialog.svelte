<script lang="ts">
    import { SearchIcon, XIcon, ChevronRightIcon, ChevronDownIcon, CpuIcon, TriangleAlertIcon, PencilIcon } from '@lucide/svelte';
    import { Dialog, Portal, Tabs } from '@skeletonlabs/skeleton-svelte';
    import type { DeviceTemplate, DeviceTemplateFunction } from '@model/device-catalog-types.ts';
    import type { Device, DeviceId, FunctionData } from '@model/configurator-types.ts';
    import { configuratorStore } from '@stores/configurator-store.svelte.ts';

    interface Props {
        open: boolean;
    }

    let { open = $bindable(false) }: Props = $props();

    type ActiveFilter = 'all' | 'installed' | 'available';

    let activeFilter          = $state<ActiveFilter>('installed');
    let searchQuery           = $state('');
    let templateResults       = $state<DeviceTemplate[]>([]);
    let expandedTemplateIds   = $state(new Set<string>());
    let expandedDeviceIds     = $state(new Set<number>());
    let pendingRemoveDeviceId = $state<DeviceId | null>(null);
    let pendingAddTemplate    = $state<DeviceTemplate | null>(null);
    let newInstanceName       = $state('');
    let pendingEditDevice     = $state<Device | null>(null);
    let editName              = $state('');

    const searchPlaceholder = $derived(
        activeFilter === 'installed' ? 'Filter installed devices…' : 'Search devices…'
    );

    $effect(() => {
        const query = searchQuery.trim();

        if (activeFilter === 'installed' || !query) {
            templateResults = [];
            return;
        }

        configuratorStore.deviceService.search(query).then(results => {
            templateResults = results;
        });
    });

    const availableFilteredTemplates = $derived(
        templateResults.filter(template => {
            const instanceCount = configuratorStore.devices.filter(d => d.sourceId === template.identifier).length;
            return instanceCount === 0 || template.allowsMultipleInstances;
        })
    );

    const visibleInstances = $derived(
        configuratorStore.devices.filter(device => {
            const query = searchQuery.trim().toLowerCase();

            if (!query) {
                return true;
            }

            return (
                device.name.toLowerCase().includes(query) ||
                device.manufacturer.toLowerCase().includes(query) ||
                device.type.toLowerCase().includes(query)
            );
        })
    );

    function instancesForTemplate(template: DeviceTemplate): Device[] {
        return configuratorStore.devices.filter(d => d.sourceId === template.identifier);
    }

    function toggleTemplate(identifier: string) {
        const next = new Set(expandedTemplateIds);

        if (next.has(identifier)) {
            next.delete(identifier);
        } else {
            next.add(identifier);
        }

        expandedTemplateIds = next;
    }

    function toggleDevice(deviceId: number) {
        const next = new Set(expandedDeviceIds);

        if (next.has(deviceId)) {
            next.delete(deviceId);
        } else {
            next.add(deviceId);
        }

        expandedDeviceIds = next;
    }

    function functionDataSummary(data: FunctionData): string {
        if (data.type === 'ir') {
            return `${data.protocol.toUpperCase()}  0x${data.code.toString(16).toUpperCase()}`;
        }

        if (data.type === 'rest') {
            return `${data.method}  ${data.url}`;
        }

        return '';
    }

    function templateFunctionSummary(fn: DeviceTemplateFunction): string {
        return functionDataSummary(fn.data);
    }

    function installedBadgeLabel(count: number): string {
        return count === 1 ? 'Installed' : `${count} installed`;
    }

    function handleAddClick(template: DeviceTemplate) {
        if (template.allowsMultipleInstances) {
            pendingAddTemplate = template;
            newInstanceName    = '';
        } else {
            configuratorStore.addDevice(template);
        }
    }

    function handleAddConfirm() {
        if (pendingAddTemplate !== null && newInstanceName.trim()) {
            configuratorStore.addDevice(pendingAddTemplate, newInstanceName.trim());
            pendingAddTemplate = null;
            newInstanceName    = '';
        }
    }

    function handleRemoveClick(deviceId: DeviceId) {
        pendingRemoveDeviceId = deviceId;
    }

    function handleRemoveConfirm() {
        if (pendingRemoveDeviceId !== null) {
            configuratorStore.removeDevice(pendingRemoveDeviceId);
            pendingRemoveDeviceId = null;
        }
    }

    function handleEditClick(device: Device) {
        pendingEditDevice = device;
        editName          = device.name;
    }

    function handleEditConfirm() {
        if (pendingEditDevice !== null && editName.trim()) {
            configuratorStore.renameDevice(pendingEditDevice.id, editName.trim());
            pendingEditDevice = null;
            editName          = '';
        }
    }

    function handleClose() {
        open                = false;
        searchQuery         = '';
        templateResults     = [];
        expandedTemplateIds = new Set();
        expandedDeviceIds   = new Set();
    }

    const ACCORDION_PREVIEW_COUNT = 4;
</script>

<!-- ── Device management dialog ── -->
<Dialog
    open={open}
    onOpenChange={(details) => { if (!details.open) handleClose(); }}
>
    <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
            <Dialog.Content class="card bg-surface-100-900 shadow-xl flex flex-col w-[min(560px,92vw)] h-[min(640px,85vh)] p-0 overflow-hidden">

                <!-- Header -->
                <div class="flex items-center justify-between px-4 py-3 shrink-0 border-b border-surface-200-800">
                    <Dialog.Title class="text-base font-semibold m-0">Devices</Dialog.Title>
                    <Dialog.CloseTrigger class="btn-icon hover:preset-tonal size-7">
                        <XIcon class="size-4" />
                    </Dialog.CloseTrigger>
                </div>

                <!-- Search -->
                <div class="px-3 pt-3 shrink-0">
                    <div class="relative">
                        <SearchIcon class="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500-400 pointer-events-none" />
                        <input
                            class="input pl-8 {searchQuery ? 'pr-8' : ''} w-full"
                            placeholder={searchPlaceholder}
                            value={searchQuery}
                            oninput={(e: Event) => { searchQuery = (e.target as HTMLInputElement).value; }}
                        />
                        {#if searchQuery}
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <button
                                class="absolute right-2 top-1/2 -translate-y-1/2 btn-icon hover:preset-tonal size-5"
                                onclick={() => { searchQuery = ''; }}
                            >
                                <XIcon class="size-3" />
                            </button>
                        {/if}
                    </div>
                </div>

                <!-- Tabs -->
                <Tabs
                    value={activeFilter}
                    onValueChange={(details) => { activeFilter = details.value as ActiveFilter; }}
                    class="flex flex-col flex-1 overflow-hidden"
                >
                    <Tabs.List class="flex shrink-0 mx-3 mt-2 mb-0 bg-surface-200-800 rounded-lg p-0.5 gap-0.5">
                        <Tabs.Trigger
                            value="all"
                            class="flex-1 text-sm py-1.5 px-3 rounded-md transition-colors data-[selected]:bg-surface-50-950 data-[selected]:font-semibold data-[selected]:shadow-sm"
                        >All</Tabs.Trigger>
                        <Tabs.Trigger
                            value="installed"
                            class="flex-1 text-sm py-1.5 px-3 rounded-md transition-colors data-[selected]:bg-surface-50-950 data-[selected]:font-semibold data-[selected]:shadow-sm"
                        >
                            Installed
                            {#if configuratorStore.devices.length > 0}
                                <span class="badge preset-tonal rounded-full ml-1 text-xs">{configuratorStore.devices.length}</span>
                            {/if}
                        </Tabs.Trigger>
                        <Tabs.Trigger
                            value="available"
                            class="flex-1 text-sm py-1.5 px-3 rounded-md transition-colors data-[selected]:bg-surface-50-950 data-[selected]:font-semibold data-[selected]:shadow-sm"
                        >Available</Tabs.Trigger>
                    </Tabs.List>

                    <!-- All tab -->
                    <Tabs.Content value="all" class="flex-1 overflow-y-auto mt-1">
                        {@render templateBrowseList(templateResults)}
                    </Tabs.Content>

                    <!-- Installed tab -->
                    <Tabs.Content value="installed" class="flex-1 overflow-y-auto mt-1">
                        {#if visibleInstances.length > 0}
                            {#each visibleInstances as device (device.id)}
                                {@const isExpanded = expandedDeviceIds.has(device.id)}
                                <div class="device-row border-b border-surface-200-800">
                                    <div class="flex items-start gap-2 px-3 py-2.5">
                                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                                        <button
                                            class="btn-icon hover:preset-tonal size-5 shrink-0 mt-0.5"
                                            onclick={() => toggleDevice(device.id)}
                                            aria-label={isExpanded ? 'Collapse functions' : 'Expand functions'}
                                        >
                                            {#if isExpanded}
                                                <ChevronDownIcon class="size-3.5" />
                                            {:else}
                                                <ChevronRightIcon class="size-3.5" />
                                            {/if}
                                        </button>

                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2 flex-wrap">
                                                <span class="text-sm font-semibold truncate">{device.name}</span>
                                                <span class="badge rounded-full shrink-0 {device.type === 'ir' ? 'preset-tonal-primary' : 'preset-tonal-warning'}">
                                                    {device.type.toUpperCase()}
                                                </span>
                                            </div>
                                            <div class="text-xs text-surface-500-400 mt-0.5">
                                                {device.manufacturer} · {device.functions.length} functions
                                            </div>
                                        </div>

                                        <div class="flex items-center gap-1.5 shrink-0">
                                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                                            <button
                                                class="btn-icon btn-icon-sm hover:preset-tonal"
                                                title="Rename device"
                                                onclick={() => handleEditClick(device)}
                                            >
                                                <PencilIcon class="size-3.5" />
                                            </button>
                                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                                            <button
                                                class="btn btn-sm preset-outlined-error-500"
                                                onclick={() => handleRemoveClick(device.id)}
                                            >Remove</button>
                                        </div>
                                    </div>

                                    {#if isExpanded}
                                        <div class="accordion-content mx-3 mb-2.5 rounded border border-surface-200-800 overflow-hidden">
                                            {#each device.functions as fn (fn.id)}
                                                <div class="fn-row flex justify-between items-baseline px-3 py-1.5 gap-4 border-b border-surface-200-800 last:border-b-0">
                                                    <span class="text-xs shrink-0">{fn.name}</span>
                                                    <span class="text-xs font-mono text-surface-500-400 text-right truncate">{functionDataSummary(fn.data)}</span>
                                                </div>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        {:else if configuratorStore.devices.length === 0}
                            <div class="flex flex-col items-center justify-center gap-3 p-10 text-surface-500-400 text-sm text-center">
                                <CpuIcon class="size-8 opacity-40" />
                                <span>No devices installed yet.</span>
                                <span class="text-xs opacity-70">Switch to <strong>All</strong> or <strong>Available</strong> and search to add devices.</span>
                            </div>
                        {:else}
                            <div class="p-8 text-center text-surface-500-400 text-sm">
                                No installed devices match &ldquo;{searchQuery.trim()}&rdquo;
                            </div>
                        {/if}
                    </Tabs.Content>

                    <!-- Available tab -->
                    <Tabs.Content value="available" class="flex-1 overflow-y-auto mt-1">
                        {@render templateBrowseList(availableFilteredTemplates)}
                    </Tabs.Content>
                </Tabs>

            </Dialog.Content>
        </Dialog.Positioner>
    </Portal>
</Dialog>

<!-- ── Template browse list (shared by All and Available tabs) ── -->
{#snippet templateBrowseList(templates: DeviceTemplate[])}
    {#if !searchQuery.trim()}
        <div class="flex flex-col items-center justify-center gap-3 p-10 text-surface-500-400 text-sm text-center">
            <SearchIcon class="size-8 opacity-40" />
            <span>Type to search for devices.</span>
        </div>
    {:else if templates.length > 0}
        {#each templates as template (template.identifier)}
            {@const instances = instancesForTemplate(template)}
            {@const hasInstances = instances.length > 0}
            {@const isExpanded = expandedTemplateIds.has(template.identifier)}
            {@const showAddButton = !hasInstances || template.allowsMultipleInstances}
            <div class="device-row border-b border-surface-200-800">
                <div class="flex items-start gap-2 px-3 py-2.5">
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <button
                        class="btn-icon hover:preset-tonal size-5 shrink-0 mt-0.5"
                        onclick={() => toggleTemplate(template.identifier)}
                        aria-label={isExpanded ? 'Collapse functions' : 'Expand functions'}
                    >
                        {#if isExpanded}
                            <ChevronDownIcon class="size-3.5" />
                        {:else}
                            <ChevronRightIcon class="size-3.5" />
                        {/if}
                    </button>

                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-sm font-semibold truncate">{template.name}</span>
                            <span class="badge rounded-full shrink-0 {template.type === 'ir' ? 'preset-tonal-primary' : 'preset-tonal-warning'}">
                                {template.type.toUpperCase()}
                            </span>
                            {#if hasInstances}
                                <span class="badge preset-filled-success-500 rounded-full shrink-0 text-xs">
                                    {installedBadgeLabel(instances.length)}
                                </span>
                            {/if}
                        </div>
                        <div class="text-xs text-surface-500-400 mt-0.5">
                            {template.manufacturer} · {template.providerName} · {template.functions.length} functions
                        </div>
                    </div>

                    {#if showAddButton}
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <button
                            class="btn btn-sm hover:preset-tonal shrink-0"
                            onclick={() => handleAddClick(template)}
                        >
                            {hasInstances ? 'Add another' : 'Add'}
                        </button>
                    {/if}
                </div>

                {#if isExpanded}
                    {@const previewFunctions = template.functions.slice(0, ACCORDION_PREVIEW_COUNT)}
                    {@const remainingCount = template.functions.length - ACCORDION_PREVIEW_COUNT}
                    <div class="accordion-content mx-3 mb-2.5 rounded border border-surface-200-800 overflow-hidden">
                        {#each previewFunctions as fn (fn.name)}
                            <div class="fn-row flex justify-between items-baseline px-3 py-1.5 gap-4 border-b border-surface-200-800 last:border-b-0">
                                <span class="text-xs shrink-0">{fn.name}</span>
                                <span class="text-xs font-mono text-surface-500-400 text-right truncate">{templateFunctionSummary(fn)}</span>
                            </div>
                        {/each}
                        {#if remainingCount > 0}
                            <div class="px-3 py-1.5 text-xs text-surface-500-400 italic">
                                + {remainingCount} more
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        {/each}
    {:else}
        <div class="p-8 text-center text-surface-500-400 text-sm">
            No devices found matching &ldquo;{searchQuery.trim()}&rdquo;
        </div>
    {/if}
{/snippet}

<!-- ── Remove confirmation dialog ── -->
<Dialog
    open={pendingRemoveDeviceId !== null}
    onOpenChange={(details) => { if (!details.open) pendingRemoveDeviceId = null; }}
>
    <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-[60] bg-surface-950/50" />
        <Dialog.Positioner class="fixed inset-0 z-[60] flex justify-center items-center p-4">
            <Dialog.Content class="card bg-surface-100-900 w-full max-w-sm p-4 space-y-3 shadow-xl">
                <div class="flex items-center gap-2 text-error-500">
                    <TriangleAlertIcon class="size-5 shrink-0" />
                    <Dialog.Title class="text-base font-semibold">Remove device</Dialog.Title>
                </div>
                {@const deviceToRemove = configuratorStore.devices.find(d => d.id === pendingRemoveDeviceId)}
                <p class="text-sm m-0">
                    Are you sure you want to remove <strong>{deviceToRemove?.name ?? 'this device'}</strong>?
                    Any button mappings using this device will be cleared.
                </p>
                <footer class="flex justify-end gap-2 pt-1">
                    <Dialog.CloseTrigger class="btn hover:preset-tonal">Cancel</Dialog.CloseTrigger>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <button class="btn preset-outlined-error-500" onclick={handleRemoveConfirm}>Remove</button>
                </footer>
            </Dialog.Content>
        </Dialog.Positioner>
    </Portal>
</Dialog>

<!-- ── Add instance name dialog (multi-instance templates) ── -->
<Dialog
    open={pendingAddTemplate !== null}
    onOpenChange={(details) => { if (!details.open) pendingAddTemplate = null; }}
>
    <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-[60] bg-surface-950/50" />
        <Dialog.Positioner class="fixed inset-0 z-[60] flex justify-center items-center p-4">
            <Dialog.Content class="card bg-surface-100-900 w-full max-w-sm p-4 space-y-4 shadow-xl">
                <Dialog.Title class="text-base font-semibold">Add {pendingAddTemplate?.name}</Dialog.Title>
                <label class="label">
                    <span class="label-text text-sm">Name</span>
                    <input
                        class="input"
                        placeholder="e.g. Living Room"
                        value={newInstanceName}
                        oninput={(e: Event) => { newInstanceName = (e.target as HTMLInputElement).value; }}
                    />
                </label>
                <footer class="flex justify-end gap-2">
                    <Dialog.CloseTrigger class="btn hover:preset-tonal">Cancel</Dialog.CloseTrigger>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <button
                        class="btn preset-filled-primary-500"
                        disabled={!newInstanceName.trim()}
                        onclick={handleAddConfirm}
                    >Add</button>
                </footer>
            </Dialog.Content>
        </Dialog.Positioner>
    </Portal>
</Dialog>

<!-- ── Edit device name dialog ── -->
<Dialog
    open={pendingEditDevice !== null}
    onOpenChange={(details) => { if (!details.open) pendingEditDevice = null; }}
>
    <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-[60] bg-surface-950/50" />
        <Dialog.Positioner class="fixed inset-0 z-[60] flex justify-center items-center p-4">
            <Dialog.Content class="card bg-surface-100-900 w-full max-w-sm p-4 space-y-4 shadow-xl">
                <Dialog.Title class="text-base font-semibold">Rename device</Dialog.Title>
                <label class="label">
                    <span class="label-text text-sm">Name</span>
                    <input
                        class="input"
                        value={editName}
                        oninput={(e: Event) => { editName = (e.target as HTMLInputElement).value; }}
                    />
                </label>
                <footer class="flex justify-end gap-2">
                    <Dialog.CloseTrigger class="btn hover:preset-tonal">Cancel</Dialog.CloseTrigger>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <button
                        class="btn preset-filled-primary-500"
                        disabled={!editName.trim()}
                        onclick={handleEditConfirm}
                    >Save</button>
                </footer>
            </Dialog.Content>
        </Dialog.Positioner>
    </Portal>
</Dialog>

<style>
    .device-row { transition: background-color 0.1s; }
    .device-row:hover { background: light-dark(var(--color-surface-50), var(--color-surface-850)); }

    .fn-row:hover { background: light-dark(var(--color-surface-100), var(--color-surface-800)); }
</style>
