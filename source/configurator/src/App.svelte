<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/card/card.js';
    import '@shoelace-style/shoelace/dist/components/icon/icon.js';
    import '@shoelace-style/shoelace/dist/components/spinner/spinner.js';
    import { loadAppConfig } from './app-config.ts';
    import { loadLayout } from '@layout/layout-loader.ts';
    import type { RemoteLayout } from '@layout/layout-types.ts';
    import type { RemoteConfig } from '@model/context.ts';
    import RemotePreview from '@components/RemotePreview.svelte';

    let layout = $state<RemoteLayout | null>(null);
    let remoteConfig = $state<RemoteConfig>({ rootContextId: 1, contexts: [] });
    let loadError = $state<string | null>(null);

    async function initialize() {
        const appConfig = await loadAppConfig();
        const defaultLayout = appConfig.layouts.find(layoutEntry => layoutEntry.id === appConfig.defaultLayout);

        if (!defaultLayout) {
            throw new Error('Default layout not found in app-config.json');
        }

        layout = await loadLayout(defaultLayout.path);
    }

    initialize().catch(error => {
        loadError = String(error);
    });
</script>

<div class="d-flex flex-col min-h-screen">
    <header class="d-flex items-center gap-xl py-m px-xl glass border-bottom sticky">
        <a class="wordmark d-flex items-center gap-xs no-underline font-mono font-semibold text-xl lh-denser" href="/" aria-label="OpenIRis home">
            <svg class="mark-icon shrink-0" viewBox="0 0 100 100" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <!-- outer ring -->
                <circle cx="50" cy="50" r="40" fill="none" stroke-width="2.5" class="mark-primary-stroke"/>
                <!-- pupil -->
                <circle cx="50" cy="50" r="15" class="mark-primary-fill"/>
                <!-- cardinal tick marks -->
                <line x1="50" y1="10" x2="50" y2="22" stroke-width="2.5" class="mark-primary-stroke"/>
                <line x1="50" y1="78" x2="50" y2="90" stroke-width="2.5" class="mark-primary-stroke"/>
                <line x1="10" y1="50" x2="22" y2="50" stroke-width="2.5" class="mark-primary-stroke"/>
                <line x1="78" y1="50" x2="90" y2="50" stroke-width="2.5" class="mark-primary-stroke"/>
                <!-- diagonal tick marks -->
                <line x1="22" y1="22" x2="29" y2="29" stroke-width="2" class="mark-secondary-stroke"/>
                <line x1="78" y1="22" x2="71" y2="29" stroke-width="2" class="mark-secondary-stroke"/>
                <line x1="78" y1="78" x2="71" y2="71" stroke-width="2" class="mark-secondary-stroke"/>
                <line x1="22" y1="78" x2="29" y2="71" stroke-width="2" class="mark-secondary-stroke"/>
                <!-- gold stamen center dot -->
                <circle cx="50" cy="50" r="4.5" class="mark-accent-fill"/>
            </svg>
            <span class="wordmark-open">Open</span><span class="wordmark-ir">IR</span><span class="wordmark-is">is</span>
        </a>
        <span class="font-mono text-2xs font-normal tracking-looser text-muted uppercase self-end pb-3xs">OPEN SOURCE UNIVERSAL REMOTE</span>
    </header>

    <main class="d-flex flex-1 justify-center items-start p-2xl">
        {#if loadError}
            <sl-card class="status-card error-card">
                <div slot="header" class="d-flex items-center gap-s">
                    <sl-icon name="exclamation-octagon-fill" class="text-l"></sl-icon>
                    <span class="font-semibold">Load Error</span>
                </div>
                <p class="m-0 text-s text-muted">{loadError}</p>
            </sl-card>
        {:else if layout}
            <RemotePreview layout={layout} config={remoteConfig} />
        {:else}
            <sl-card class="status-card">
                <div class="d-flex items-center gap-m">
                    <sl-spinner class="text-primary text-xl"></sl-spinner>
                    <span class="text-s text-muted">Loading…</span>
                </div>
            </sl-card>
        {/if}
    </main>
</div>

<style>
    .mark-icon {
        width: 32px;
        height: 32px;
    }

    :global(.mark-primary-stroke) { stroke: var(--color-primary); fill: none; }
    :global(.mark-primary-fill)   { fill: var(--color-primary); }
    :global(.mark-secondary-stroke) { stroke: var(--color-secondary); fill: none; }
    :global(.mark-accent-fill)    { fill: var(--color-accent); opacity: 0.9; }

    .wordmark-open { color: var(--color-text-primary); }
    .wordmark-ir   { color: var(--color-primary); }
    .wordmark-is   { color: var(--color-secondary); }
    .wordmark:hover { text-decoration: none; }

    .status-card {
        width: 24rem;
        max-width: 90vw;
    }

    .error-card {
        --sl-panel-border-color: var(--sl-color-danger-500);
        color: var(--sl-color-danger-600);
    }
</style>
