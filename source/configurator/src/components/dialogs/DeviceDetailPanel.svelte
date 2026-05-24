<script lang="ts">
    import type { CatalogDevice, CatalogDeviceFunction } from '@model/device-catalog-types.ts';

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

<div class="flex flex-col h-full overflow-hidden">
    <div class="p-4 border-b border-surface-200-800 shrink-0">
        <div class="text-lg font-semibold mb-1">{device.name}</div>
        <div class="flex items-center gap-2">
            <span class="text-sm text-surface-500-400">{device.manufacturer}</span>
            <span class="opacity-40 text-sm">·</span>
            <span class="badge rounded-full {device.type === 'ir' ? 'preset-tonal-primary' : 'preset-tonal-warning'}">
                {device.type.toUpperCase()}
            </span>
            <span class="opacity-40 text-sm">·</span>
            <span class="text-sm text-surface-500-400">{device.functions.length} functions</span>
        </div>
    </div>

    <div class="flex-1 overflow-y-auto py-2">
        {#each device.functions as fn (fn.name)}
            <div class="fn-row flex justify-between items-baseline px-4 py-2 gap-4">
                <span class="text-sm shrink-0">{fn.name}</span>
                <span class="text-xs font-mono text-surface-500-400 text-right truncate">{functionSummary(fn)}</span>
            </div>
        {/each}
    </div>
</div>

<style>
    .fn-row:hover { background: light-dark(var(--color-surface-100), var(--color-surface-800)); }
</style>
