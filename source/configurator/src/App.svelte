<script lang="ts">
    import { CpuIcon, UploadIcon, DownloadIcon, PlusCircleIcon, PencilIcon, Trash2Icon, OctagonAlertIcon, TriangleAlertIcon, XIcon } from '@lucide/svelte';
    import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
    import type { State } from '@model/configurator-types.ts';
    import { configuratorStore } from '@stores/configurator-store.svelte.ts';
    import { uiStore } from '@stores/ui-store.svelte.ts';
    import { downloadFile, pickFile } from '@utils/file-utils.ts';
    import RemotePreview from '@components/preview/RemotePreview.svelte';
    import InspectorPanel from '@components/inspector/InspectorPanel.svelte';
    import StateEditDialog from '@components/dialogs/StateEditDialog.svelte';
    import DeviceDiscoveryDialog from '@components/dialogs/DeviceDiscoveryDialog.svelte';

    configuratorStore.loadLayout();

    // ── Panel resize ──────────────────────────────────────────────────────────

    function startResize(e: MouseEvent) {
        const startX     = e.clientX;
        const startWidth = uiStore.panel.width;
        function onMove(moveEvent: MouseEvent) {
            uiStore.setPanelWidth(Math.max(200, Math.min(600, startWidth + (startX - moveEvent.clientX))));
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

    // ── State CRUD ────────────────────────────────────────────────────────────

    function handleStateChange(e: Event) {
        configuratorStore.selectState(Number((e.target as HTMLSelectElement).value));
    }

    function handleStateEditConfirm(draft: State) {
        if (uiStore.stateEditDialog.mode === 'create') {
            const newId = configuratorStore.addState(draft);
            configuratorStore.selectState(newId);
            uiStore.clearSelection();
        } else {
            configuratorStore.updateState(draft);
        }
        uiStore.closeStateEditDialog();
    }

    function confirmStateDelete() {
        configuratorStore.deleteState(configuratorStore.selectedStateId);
        uiStore.clearSelection();
        uiStore.closeDeleteDialog();
    }

    // ── Import / export ───────────────────────────────────────────────────────

    async function handleExport() {
        const bytes = await configuratorStore.importExportService.serialize(configuratorStore.toWireConfig());
        downloadFile(bytes, 'remote.bin');
    }

    async function handleImport() {
        try {
            const bytes = await pickFile('.bin');
            configuratorStore.loadFromWireConfig(await configuratorStore.importExportService.deserialize(bytes));
            uiStore.setImportError(null);
        } catch (error) {
            uiStore.setImportError(`Import failed: ${error}`);
        }
    }
</script>

<div class="flex flex-col h-screen overflow-hidden bg-surface-50-900">

    <header class="grid grid-cols-[1fr_auto_1fr] items-center py-3 px-6 bg-surface-100-900/80 backdrop-blur-sm border-b border-surface-200-800 sticky top-0 z-10">
        <div class="flex items-center gap-6">
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
        </div>

        <div class="flex items-center gap-1">
            {#if configuratorStore.layout}
                <select
                    class="select w-56"
                    value={String(configuratorStore.selectedStateId)}
                    onchange={handleStateChange}
                >
                    {#each configuratorStore.states as s (s.id)}
                        <option value={String(s.id)}>{s.name}</option>
                    {/each}
                </select>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <button class="btn-icon hover:preset-tonal" title="Add state" onclick={() => uiStore.openStateCreate()}>
                    <PlusCircleIcon class="size-4" />
                </button>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <button class="btn-icon hover:preset-tonal" title="Edit state" onclick={() => uiStore.openStateEdit(configuratorStore.selectedState)}>
                    <PencilIcon class="size-4" />
                </button>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <button
                    class="btn-icon hover:preset-tonal"
                    title="Delete state"
                    disabled={configuratorStore.selectedState.stateType === 'root'}
                    onclick={() => uiStore.openDeleteDialog(configuratorStore.selectedState.name)}
                >
                    <Trash2Icon class="size-4" />
                </button>
            {/if}
        </div>

        <div class="flex items-center gap-3 justify-end">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button class="btn btn-sm hover:preset-tonal" onclick={() => { uiStore.deviceDialogOpen = true; }}>
                <CpuIcon class="size-4" />
                Devices
                {#if configuratorStore.devices.length > 0}
                    <span class="badge preset-filled-primary-500 rounded-full">
                        {configuratorStore.devices.length}
                    </span>
                {/if}
            </button>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button class="btn btn-sm hover:preset-tonal" title="Import remote.bin" onclick={handleImport} disabled={!configuratorStore.layout}>
                <UploadIcon class="size-4" />
                Import
            </button>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button class="btn btn-sm preset-filled-primary-500" title="Export remote.bin" onclick={handleExport} disabled={!configuratorStore.layout}>
                <DownloadIcon class="size-4" />
                Export
            </button>
        </div>
    </header>

    <!--
        main must be a flex child that can shrink: min-height:0 prevents it
        from expanding to fit its content and breaking the layout.
    -->
    <main class="flex flex-1 min-h-0 overflow-hidden">
        {#if configuratorStore.loadError}
            <div class="flex w-full justify-center items-center">
                <div class="card bg-surface-100-900 preset-outlined-error-500 p-4 w-96 max-w-[90vw] space-y-3 shadow-md">
                    <div class="flex items-center gap-3">
                        <OctagonAlertIcon class="size-5 text-error-500" />
                        <span class="font-semibold">Load Error</span>
                    </div>
                    <p class="m-0 text-sm text-surface-500-400">{configuratorStore.loadError}</p>
                </div>
            </div>
        {:else if configuratorStore.layout}
            <RemotePreview />
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <div
                class="resize-handle"
                role="separator"
                aria-orientation="vertical"
                onmousedown={startResize}
            ></div>
            <InspectorPanel />
            {#if uiStore.importError}
                <div class="import-toast">
                    <TriangleAlertIcon class="size-4 text-warning-500 shrink-0" />
                    <span class="text-sm">{uiStore.importError}</span>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <button class="btn-icon hover:preset-tonal size-5 shrink-0" onclick={() => uiStore.setImportError(null)} aria-label="Dismiss">
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

    <DeviceDiscoveryDialog bind:open={uiStore.deviceDialogOpen} />

    <StateEditDialog
        open={uiStore.stateEditDialog.open}
        mode={uiStore.stateEditDialog.mode}
        initialState={uiStore.stateEditDialog.initialState}
        onConfirm={handleStateEditConfirm}
        onCancel={() => uiStore.closeStateEditDialog()}
    />

    <Dialog
        open={uiStore.deleteDialog.open}
        onOpenChange={(details) => { if (!details.open) uiStore.closeDeleteDialog(); }}
    >
        <Portal>
            <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
            <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
                <Dialog.Content class="card bg-surface-100-900 w-80 p-4 space-y-4 shadow-xl">
                    <Dialog.Title class="text-base font-semibold">Delete State?</Dialog.Title>
                    <p class="text-sm m-0">Delete &ldquo;{uiStore.deleteDialog.pendingName}&rdquo;? This cannot be undone.</p>
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
