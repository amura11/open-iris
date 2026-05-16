<script lang="ts">
    import type { CatalogDevice, CatalogDeviceFunction } from '@catalog/catalog-source.ts';

    interface Props {
        device: CatalogDevice;
    }

    let { device }: Props = $props();

    function functionSummary(fn: CatalogDeviceFunction): string {
        const d = fn.data;

        if (d.type === 'ir') {
            return `${d.protocol.toUpperCase()}  0x${d.code.toString(16).toUpperCase()}`;
        }

        if (d.type === 'rest') {
            return `${d.method}  ${d.url}`;
        }

        return '';
    }
</script>

<div class="d-flex flex-col h-full overflow-hidden">
    <div class="p-m border-bottom shrink-0">
        <div class="text-l font-semibold mb-2xs">{device.name}</div>
        <div class="d-flex items-center gap-xs">
            <span class="text-s text-muted">{device.manufacturer}</span>
            <span class="separator text-s">·</span>
            <sl-badge variant={device.type === 'ir' ? 'primary' : 'warning'} pill>
                {device.type.toUpperCase()}
            </sl-badge>
            <span class="separator text-s">·</span>
            <span class="text-s text-muted">{device.functions.length} functions</span>
        </div>
    </div>

    <div class="flex-1 overflow-y-auto py-xs">
        {#each device.functions as fn (fn.name)}
            <div class="fn-row d-flex justify-between items-baseline px-m py-xs gap-m">
                <span class="text-s shrink-0">{fn.name}</span>
                <span class="text-xs font-mono text-muted text-right truncate">{functionSummary(fn)}</span>
            </div>
        {/each}
    </div>
</div>

<style>
    .fn-row:hover { background: var(--sl-color-neutral-50); }
    .separator    { color: var(--sl-color-neutral-300); }
</style>
