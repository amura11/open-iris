<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/card/card.js';
    import '@shoelace-style/shoelace/dist/components/icon/icon.js';
    import '@shoelace-style/shoelace/dist/components/spinner/spinner.js';
    import '@shoelace-style/shoelace/dist/components/button/button.js';
    import '@shoelace-style/shoelace/dist/components/tooltip/tooltip.js';
    import '@shoelace-style/shoelace/dist/components/select/select.js';
    import '@shoelace-style/shoelace/dist/components/option/option.js';
    import { loadAppConfig } from './app-config.ts';
    import { loadLayout } from '@layout/layout-loader.ts';
    import type { RemoteLayout } from '@layout/layout-types.ts';
    import type { State, RemoteConfig } from '@model/state.ts';
    import type { Selection } from '@model/selection.ts';
    import { downloadBin } from '@serialization/writer.ts';
    import { deserialize } from '@serialization/reader.ts';
    import RemotePreview from '@components/RemotePreview.svelte';
    import InspectorPanel from '@components/InspectorPanel.svelte';

    let layout = $state<RemoteLayout | null>(null);
    let remoteConfig = $state<RemoteConfig>({
        rootStateId: 1,
        states: [{
            id: 1,
            name: 'Root',
            stateType: 'root',
            items: [],
            buttonConfigs: [],
            onActivate: [],
            onDeactivate: [],
            buttonFallback: false,
        }],
    });
    let loadError   = $state<string | null>(null);
    let importError = $state<string | null>(null);

    let selectedStateId = $state(1); // mirrors initial remoteConfig.rootStateId
    let selectedState   = $derived(
        remoteConfig.states.find(s => s.id === selectedStateId) ?? remoteConfig.states[0]
    );

    let selection      = $state<Selection>(null);
    let panelWidth     = $state(300);
    let panelCollapsed = $state(false);

    function togglePanel() { panelCollapsed = !panelCollapsed; }

    function startResize(e: MouseEvent) {
        const startX     = e.clientX;
        const startWidth = panelWidth;
        function onMove(e: MouseEvent) {
            panelWidth = Math.max(200, Math.min(600, startWidth + (startX - e.clientX)));
        }
        function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.documentElement.style.cursor    = '';
            document.documentElement.style.userSelect = '';
        }
        document.documentElement.style.cursor    = 'col-resize';
        document.documentElement.style.userSelect = 'none';
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    async function initialize() {
        const appConfig = await loadAppConfig();
        const defaultLayout = appConfig.layouts.find(l => l.id === appConfig.defaultLayout);
        if (!defaultLayout) throw new Error('Default layout not found in app-config.json');
        layout = await loadLayout(defaultLayout.path);
    }

    initialize().catch(err => { loadError = String(err); });

    function handleScreenClick() { selection = { type: 'screen' }; }

    function handleButtonClick(buttonCode: string) { selection = { type: 'button', buttonCode }; }

    function handleStateUpdate(updated: State) {
        remoteConfig = {
            ...remoteConfig,
            states: remoteConfig.states.map(s => s.id === updated.id ? updated : s),
        };
    }

    function handleStateChange(e: Event) {
        selectedStateId = Number((e.target as HTMLSelectElement).value);
    }

    function handleExport() { downloadBin(remoteConfig); }

    function handleImport() {
        const input = document.createElement('input');
        input.type   = 'file';
        input.accept = '.bin';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
                remoteConfig    = deserialize(new Uint8Array(await file.arrayBuffer()));
                selectedStateId = remoteConfig.rootStateId;
                importError     = null;
            } catch (e) {
                importError = `Import failed: ${e}`;
            }
        };
        input.click();
    }
</script>

<div class="shell d-flex flex-col min-h-screen">

    <header class="d-flex items-center gap-xl py-m px-xl glass border-bottom sticky">
        <a class="wordmark d-flex items-center gap-xs no-underline font-mono font-semibold text-xl lh-denser" href="/" aria-label="OpenIRis home">
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
        <span class="font-mono text-2xs font-normal tracking-looser text-muted uppercase self-end pb-3xs">OPEN SOURCE UNIVERSAL REMOTE</span>

        <div class="d-flex items-center gap-s ml-auto">
            <sl-tooltip content="Import remote.bin">
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <sl-button size="small" onclick={handleImport} disabled={!layout}>
                    <sl-icon slot="prefix" name="upload"></sl-icon>
                    Import
                </sl-button>
            </sl-tooltip>
            <sl-tooltip content="Export remote.bin">
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <sl-button size="small" variant="primary" onclick={handleExport} disabled={!layout}>
                    <sl-icon slot="prefix" name="download"></sl-icon>
                    Export
                </sl-button>
            </sl-tooltip>
        </div>
    </header>

    {#if layout}
        <div class="state-bar border-bottom">
            <sl-select
                class="state-select"
                value={String(selectedStateId)}
                size="small"
                onsl-change={handleStateChange}
            >
                {#each remoteConfig.states as s (s.id)}
                    <sl-option value={String(s.id)}>{s.name}</sl-option>
                {/each}
            </sl-select>
        </div>
    {/if}

    <!--
        main must be a flex child that can shrink: min-height:0 prevents it
        from expanding to fit its content and breaking the layout.
    -->
    <main class="canvas-area d-flex flex-1">
        {#if loadError}
            <div class="d-flex w-full justify-center items-center">
                <sl-card class="status-card error-card">
                    <div slot="header" class="d-flex items-center gap-s">
                        <sl-icon name="exclamation-octagon-fill" class="text-l"></sl-icon>
                        <span class="font-semibold">Load Error</span>
                    </div>
                    <p class="m-0 text-s text-muted">{loadError}</p>
                </sl-card>
            </div>
        {:else if layout}
            <RemotePreview
                {layout}
                config={remoteConfig}
                {selection}
                onScreenClick={handleScreenClick}
                onButtonClick={handleButtonClick}
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
                activeState={selectedState}
                width={panelWidth}
                collapsed={panelCollapsed}
                onStateUpdate={handleStateUpdate}
                onToggleCollapse={togglePanel}
                onClearSelection={() => { selection = null; }}
            />
            {#if importError}
                <div class="import-toast">
                    <sl-icon name="exclamation-triangle-fill" class="text-warning"></sl-icon>
                    <span class="text-s">{importError}</span>
                    <button class="toast-dismiss" onclick={() => (importError = null)} aria-label="Dismiss">×</button>
                </div>
            {/if}
        {:else}
            <div class="d-flex w-full justify-center items-center">
                <sl-card class="status-card">
                    <div class="d-flex items-center gap-m">
                        <sl-spinner class="text-primary text-xl"></sl-spinner>
                        <span class="text-s text-muted">Loading…</span>
                    </div>
                </sl-card>
            </div>
        {/if}
    </main>

</div>

<style>
    .shell { background: var(--color-background); }

    /* Canvas area fills the remaining height; min-height:0 lets flex children shrink */
    .canvas-area {
        min-height: 0;
        overflow: hidden;
    }

    /* ── State selector bar ──────────────────────────────────────────────── */

    .state-bar {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: var(--sl-spacing-x-small) var(--sl-spacing-medium);
        background: var(--color-surface);
        flex-shrink: 0;
    }

    .state-select {
        width: 16rem;
    }

    /* ── Panel resize handle ─────────────────────────────────────────────── */

    .resize-handle {
        width: 4px;
        flex-shrink: 0;
        cursor: col-resize;
        background: transparent;
        transition: background-color 0.15s;
    }

    .resize-handle:hover { background: var(--color-primary); opacity: 0.4; }

    /* ── Logo & wordmark ─────────────────────────────────────────────────── */

    .mark-icon { width: 32px; height: 32px; }

    :global(.mark-primary-stroke)   { stroke: var(--color-primary);   fill: none; }
    :global(.mark-primary-fill)     { fill:   var(--color-primary); }
    :global(.mark-secondary-stroke) { stroke: var(--color-secondary); fill: none; }
    :global(.mark-accent-fill)      { fill:   var(--color-accent); opacity: 0.9; }

    .wordmark-open { color: var(--color-text-primary); }
    .wordmark-ir   { color: var(--color-primary); }
    .wordmark-is   { color: var(--color-secondary); }

    /* ── Loading / error cards ───────────────────────────────────────────── */

    .status-card { width: 24rem; max-width: 90vw; }

    .error-card {
        --sl-panel-border-color: var(--sl-color-danger-500);
        color: var(--sl-color-danger-600);
    }

    /* ── Import error toast (floats over canvas) ─────────────────────────── */

    .import-toast {
        position: absolute;
        bottom: var(--sl-spacing-2x-large);
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: var(--sl-spacing-small);
        background: var(--color-surface);
        border: 1px solid var(--sl-color-warning-400);
        border-radius: var(--sl-border-radius-medium);
        padding: var(--sl-spacing-small) var(--sl-spacing-medium);
        backdrop-filter: var(--surface-glass);
        white-space: nowrap;
        z-index: 10;
    }

    .toast-dismiss {
        all: unset;
        margin-left: var(--sl-spacing-small);
        cursor: pointer;
        color: var(--color-text-secondary);
        font-size: 1.1rem;
        line-height: 1;
    }

    .toast-dismiss:hover { color: var(--color-text-primary); }
</style>
