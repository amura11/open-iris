import { downloadBin } from '@serialization/writer.ts';
import { deserialize } from '@serialization/reader.ts';
import type { RemoteConfig } from '@model/state.ts';

export async function exportConfig(config: RemoteConfig): Promise<void> {
    await downloadBin(config);
}

// Prompts the user to pick a .bin file and deserializes it.
// The returned promise settles only if a file is chosen; if the picker is
// dismissed without a selection it remains pending (no state change needed).
export function importConfig(): Promise<RemoteConfig> {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type   = 'file';
        input.accept = '.bin';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
                resolve(await deserialize(new Uint8Array(await file.arrayBuffer())));
            } catch (error) {
                reject(error);
            }
        };
        input.click();
    });
}
