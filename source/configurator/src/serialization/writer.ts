import type { RemoteConfig } from '@model/context.ts';

// TODO: Implement binary writer.
// See INITIAL_BUILD_PLAN.md for the full binary format specification.
export function serialize(_config: RemoteConfig): Uint8Array {
    throw new Error('writer.ts: not yet implemented');
}

export function downloadBin(config: RemoteConfig, filename = 'remote.bin'): void {
    const bytes = serialize(config);
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
