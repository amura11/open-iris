<script lang="ts">
    import { CpuIcon, UploadIcon, DownloadIcon, PlusCircleIcon, PencilIcon, Trash2Icon, OctagonAlertIcon, TriangleAlertIcon, XIcon } from '@lucide/svelte';
    import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
    import { loadAppConfig } from './app-config.ts';
    import { loadLayout } from '@layout/layout-loader.ts';
    import type { RemoteLayout } from '@layout/layout-types.ts';
    import type { State } from '@model/state.ts';
    import type { Selection } from '@model/selection.ts';
    import { configStore } from '@stores/config-store.svelte.ts';
    import { exportConfig, importConfig } from '@services/import-export-service.ts';
    import RemotePreview from '@components/preview/RemotePreview.svelte';
    import InspectorPanel from '@components/inspector/InspectorPanel.svelte';
    import StateEditDialog from '@components/dialogs/StateEditDialog.svelte';
    import DeviceDiscoveryDialog from '@components/dialogs/DeviceDiscoveryDialog.svelte';

    // ── Layout loading ────────────────────────────────────────────────────────

    let layout    = $state<RemoteLayout | null>(null);
    let loadError = $state<string | null>(null);

    async function initialize() {
        const appConfig = await loadAppConfig();
        const defaultLayout = appConfig.layouts.find(l => l.id === appConfig.defaultLayout);
        if (!defaultLayout) {
            throw new Error('Default layout not found in app-config.json');
        }
        layout = await loadLayout(defaultLayout.path);
    }

    initialize().catch(err => {
        loadError = String(err);
    });

    // ── UI state ──────────────────────────────────────────────────────────────

    let importError  = $state<string | null>(null);
    let selection    = $state<Selection>(null);
    let panelWidth   = $state(Math.min(600, Math.round(window.innerWidth / 3)));
    let panelCollapsed = $state(false);

    // ── Dialog state ──────────────────────────────────────────────────────────

    let deviceDialogOpen  = $state(false);
    let stateEditOpen     = $state(false);
    let stateEditMode     = $state<'create' | 'edit'>('edit');
    let stateEditInitial  = $state<State>({
        id: -1, name: 'New State', stateType: 'persistent',
        screenButtons: [], physicalButtons: [],
        onActivate: null, onDeactivate: null,
        buttonFallback: false, activeDevices: [],
    });
    let deleteDialogOpen  = $state(false);
    let pendingDeleteName = $state('');

    // ── Panel resize ──────────────────────────────────────────────────────────

    function togglePanel() {
        panelCollapsed = !panelCollapsed;
    }

    function startResize(e: MouseEvent) {
        const startX     = e.clientX;
        const startWidth = panelWidth;
        function onMove(e: MouseEvent) {
            panelWidth = Math.max(200, Math.min(600, startWidth + (startX - e.clientX)));
        }
        function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.documentElement.style.cursor     = '';
            document.documentElement.style.userSelect = '';
        }
        document.documentElement.style.cursor     = 'col-resize';
        document.documentElement.style.userSelect = 'none';
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    // ── Selection ─────────────────────────────────────────────────────────────

    function handleScreenClick() {
        selection = { type: 'screen' };
    }

    function handleButtonClick(buttonCode: string) {
        selection = { type: 'button', buttonCode };
    }

    function handleStateChange(e: Event) {
        configStore.selectState(Number((e.target as HTMLSelectElement).value));
    }

    // ── State CRUD ────────────────────────────────────────────────────────────

    function handleStateAdd() {
        stateEditInitial = {
            id: -1, name: 'New State', stateType: 'persistent',
            screenButtons: [], physicalButtons: [],
            onActivate: null, onDeactivate: null,
            buttonFallback: false, activeDevices: [],
        };
        stateEditMode = 'create';
        stateEditOpen = true;
    }

    function handleStateEdit() {
        stateEditInitial = { ...configStore.selectedState };
        stateEditMode    = 'edit';
        stateEditOpen    = true;
    }

    function handleStateEditConfirm(draft: State) {
        if (stateEditMode === 'create') {
            const newId = configStore.addState(draft);
            configStore.selectState(newId);
            selection = null;
        } else {
            configStore.updateState(draft);
        }
        stateEditOpen = false;
    }

    function handleStateEditCancel() {
        stateEditOpen = false;
    }

    function handleStateDelete() {
        pendingDeleteName = configStore.selectedState.name;
        deleteDialogOpen  = true;
    }

    function confirmStateDelete() {
        configStore.deleteState(configStore.selectedStateId);
        selection        = null;
        deleteDialogOpen = false;
    }

    // ── Import / export ───────────────────────────────────────────────────────

    async function handleExport() {
        await exportConfig(configStore.remoteConfig);
    }

    async function handleImport() {
        try {
            configStore.loadConfig(await importConfig());
            importError = null;
        } catch (error) {
            importError = `Import failed: ${error}`;
        }
    }
</script>

<div class="flex flex-col h-screen overflow-hidden bg-surface-50-900">

    <header class="flex items-center gap-6 py-3 px-6 bg-surface-100-900/80 backdrop-blur-sm border-b border-surface-200-800 sticky top-0 z-10">
        <a class="flex items-center gap-2 no-underline font-mono font-semibold text-xl leading-tight" href="/" aria-label="OpenIRis home">
            <svg class="mark-icon shrink-0" viewBox="0 0 100 100" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="40" fill="none" stroke-width="2.5" class="mark-primary-stroke"/>
                <circle cx="50" cy="50" r="15" class="mark-primary-fill"/>
                <line x1="50" y1="10" x2="50" y2="22" stroke-width="2.5" class="mark-primary-stroke"/>
                <line x1="50" y1="78" x2="50" y2="90" stroke-width="2.5" class="mark-primary-stroke"/>
                <line x1="10" y1="50" x2="22" y2="50" stroke-width="2.5" class="mark-primary-stroke"/>
                <line x1="78" y1="50" x2="90" y2="50" stroke-width="2.5" class="mark-primary-stroke"/>
                <line x1="22" y1="22" x2="29" y2="29" stroke-width="2" class="mark-secondary-stroke"/>
                <line x1="78" y1="22" x2="71" y2="29" stroke-width="2" class="mark-secondary-stroke"/>
                <line x1="78" y1="78" x2="71" y2="71" stroke-width="2" class="mark-secondary-stroke"/>
                <line x1="22" y1="78" x2="29" y2="71" stroke-width="2" class="mark-secondary-stroke"/>
                <circle cx="50" cy="50" r="4.5" class="mark-accent-fill"/>
            </svg>
            <span class="wordmark-open">Open</span><span class="wordmark-ir">IR</span><span class="wordmark-is">is</span>
        </a>
        <span class="font-mono text-[0.625rem] font-normal tracking-widest text-surface-500-400 uppercase self-end pb-0.5">OPEN SOURCE UNIVERSAL REMOTE</span>

        <div class="flex items-center gap-3 ml-auto">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button class="btn btn-sm hover:preset-tonal" onclick={() => { deviceDialogOpen = true; }}>
                <CpuIcon class="size-4" />
                Devices
                {#if configStore.remoteConfig.devices.length > 0}
                    <span class="badge preset-filled-primary-500 rounded-full">
                        {configStore.remoteConfig.devices.length}
                    </span>
                {/if}
            </button>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button class="btn btn-sm hover:preset-tonal" title="Import remote.bin" onclick={handleImport} disabled={!layout}>
                <UploadIcon class="size-4" />
                Import
            </button>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button class="btn btn-sm preset-filled-primary-500" title="Export remote.bin" onclick={handleExport} disabled={!layout}>
                <DownloadIcon class="size-4" />
                Export
            </button>
        </div>
    </header>

    {#if layout}
        <div class="state-bar flex justify-center items-center gap-1 px-4 py-2 bg-surface-100-900 border-b border-surface-200-800 shrink-0">
            <select
                class="select w-64"
                value={String(configStore.selectedStateId)}
                onchange={handleStateChange}
            >
                {#each configStore.remoteConfig.states as s (s.id)}
                    <option value={String(s.id)}>{s.name}</option>
                {/each}
            </select>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button class="btn-icon hover:preset-tonal" title="Add state" onclick={handleStateAdd}>
                <PlusCircleIcon class="size-4" />
            </button>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button class="btn-icon hover:preset-tonal" title="Edit state" onclick={handleStateEdit}>
                <PencilIcon class="size-4" />
            </button>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button
                class="btn-icon hover:preset-tonal"
                title="Delete state"
                disabled={configStore.selectedState.stateType === 'root'}
                onclick={handleStateDelete}
            >
                <Trash2Icon class="size-4" />
            </button>
        </div>
    {/if}

    <!--
        main must be a flex child that can shrink: min-height:0 prevents it
        from expanding to fit its content and breaking the layout.
    -->
    <main class="flex flex-1 min-h-0 overflow-hidden">
        {#if loadError}
            <div class="flex w-full justify-center items-center">
                <div class="card bg-surface-100-900 preset-outlined-error-500 p-4 w-96 max-w-[90vw] space-y-3 shadow-md">
                    <div class="flex items-center gap-3">
                        <OctagonAlertIcon class="size-5 text-error-500" />
                        <span class="font-semibold">Load Error</span>
                    </div>
                    <p class="m-0 text-sm text-surface-500-400">{loadError}</p>
                </div>
            </div>
        {:else if layout}
            <RemotePreview
                {layout}
                config={configStore.remoteConfig}
                activeState={configStore.selectedState}
                {selection}
                onScreenClick={handleScreenClick}
                onButtonClick={handleButtonClick}
                onEmptyClick={() => { selection = null; }}
            />
            {#if !panelCollapsed}
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <div
                    class="resize-handle"
                    role="separator"
                    aria-orientation="vertical"
                    onmousedown={startResize}
                ></div>
            {/if}
            <InspectorPanel
                {selection}
                {layout}
                activeState={configStore.selectedState}
                remoteConfig={configStore.remoteConfig}
                width={panelWidth}
                collapsed={panelCollapsed}
                onStateUpdate={(updated) => configStore.updateState(updated)}
                onConfigUpdate={(updated) => configStore.replaceConfig(updated)}
                onToggleCollapse={togglePanel}
                onClearSelection={() => { selection = null; }}
            />
            {#if importError}
                <div class="import-toast">
                    <TriangleAlertIcon class="size-4 text-warning-500 shrink-0" />
                    <span class="text-sm">{importError}</span>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <button class="btn-icon hover:preset-tonal size-5 shrink-0" onclick={() => (importError = null)} aria-label="Dismiss">
                        <XIcon class="size-3" />
                    </button>
                </div>
            {/if}
        {:else}
            <div class="flex w-full justify-center items-center">
                <div class="card bg-surface-100-900 p-4 w-96 max-w-[90vw] shadow-md">
                    <div class="flex items-center gap-4">
                        <div class="size-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent shrink-0"></div>
                        <span class="text-sm text-surface-500-400">Loading…</span>
                    </div>
                </div>
            </div>
        {/if}
    </main>

    <DeviceDiscoveryDialog
        bind:open={deviceDialogOpen}
        installedDevices={configStore.remoteConfig.devices}
        installedMeta={configStore.remoteConfig.metadata.deviceMetadata}
        onAdd={(device) => configStore.addDevice(device)}
        onRemove={(deviceId) => configStore.removeDevice(deviceId)}
    />

    <StateEditDialog
        open={stateEditOpen}
        mode={stateEditMode}
        initialState={stateEditInitial}
        onConfirm={handleStateEditConfirm}
        onCancel={handleStateEditCancel}
    />

    <Dialog
        open={deleteDialogOpen}
        onOpenChange={(details) => { deleteDialogOpen = details.open; }}
    >
        <Portal>
            <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
            <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
                <Dialog.Content class="card bg-surface-100-900 w-80 p-4 space-y-4 shadow-xl">
                    <Dialog.Title class="text-base font-semibold">Delete State?</Dialog.Title>
                    <p class="text-sm m-0">Delete &ldquo;{pendingDeleteName}&rdquo;? This cannot be undone.</p>
                    <footer class="flex justify-end gap-2">
                        <Dialog.CloseTrigger class="btn hover:preset-tonal">Cancel</Dialog.CloseTrigger>
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <button class="btn preset-outlined-error-500" onclick={confirmStateDelete}>Delete</button>
                    </footer>
                </Dialog.Content>
            </Dialog.Positioner>
        </Portal>
    </Dialog>

</div>

<style>
    /* ── Panel resize handle ─────────────────────────────────────────────── */

    .resize-handle {
        width: 4px;
        flex-shrink: 0;
        cursor: col-resize;
        background: transparent;
        transition: background-color 0.15s;
    }

    .resize-handle:hover {
        background: light-dark(var(--color-primary-600), var(--color-primary-400));
        opacity: 0.4;
    }

    /* ── Logo & wordmark ─────────────────────────────────────────────────── */

    .mark-icon { width: 32px; height: 32px; }

    :global(.mark-primary-stroke)   { stroke: light-dark(var(--color-primary-600), var(--color-primary-400)); fill: none; }
    :global(.mark-primary-fill)     { fill:   light-dark(var(--color-primary-600), var(--color-primary-400)); }
    :global(.mark-secondary-stroke) { stroke: light-dark(var(--color-secondary-600), var(--color-secondary-400)); fill: none; }
    :global(.mark-accent-fill)      { fill:   var(--color-tertiary-500); opacity: 0.9; }

    .wordmark-open { color: light-dark(var(--color-surface-900), var(--color-surface-100)); }
    .wordmark-ir   { color: light-dark(var(--color-primary-600), var(--color-primary-400)); }
    .wordmark-is   { color: light-dark(var(--color-secondary-600), var(--color-secondary-400)); }

    /* ── Import error toast (floats over canvas) ─────────────────────────── */

    .import-toast {
        position: absolute;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 0.75rem;
        background: color-mix(in oklab, light-dark(var(--color-surface-100), var(--color-surface-800)) 80%, transparent);
        border: 1px solid light-dark(var(--color-warning-400), var(--color-warning-600));
        border-radius: var(--radius-base);
        padding: 0.75rem 1rem;
        backdrop-filter: blur(12px);
        white-space: nowrap;
        z-index: 10;
    }
</style>
