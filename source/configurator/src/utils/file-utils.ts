export function downloadFile(bytes: Uint8Array, filename: string): void {
    const blob   = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const url    = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href     = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

// Opens a browser file picker filtered by the given accept string and resolves
// with the raw bytes of the selected file. The promise remains pending if the
// picker is dismissed without a selection.
export function pickFile(accept: string): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const input  = document.createElement('input');
        input.type   = 'file';
        input.accept = accept;
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) {
                return;
            }
            try {
                resolve(new Uint8Array(await file.arrayBuffer()));
            } catch (error) {
                reject(error);
            }
        };
        input.click();
    });
}
