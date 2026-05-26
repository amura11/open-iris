import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadFile } from './file-utils.ts';

describe('downloadFile', () => {
    let mockAnchor: { href: string; download: string; click: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        mockAnchor = { href: '', download: '', click: vi.fn() };
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
        vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('creates a Blob with application/octet-stream type', () => {
        downloadFile(new Uint8Array([0x49, 0x52, 0x49, 0x53]), 'remote.iris');

        const passedBlob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
        expect(passedBlob.type).toBe('application/octet-stream');
    });

    it('sets href to the object URL and download to the filename', () => {
        downloadFile(new Uint8Array([0x01, 0x02]), 'config.iris');

        expect(mockAnchor.href).toBe('blob:mock-url');
        expect(mockAnchor.download).toBe('config.iris');
    });

    it('clicks the anchor to trigger the download', () => {
        downloadFile(new Uint8Array([0x01]), 'config.iris');

        expect(mockAnchor.click).toHaveBeenCalledOnce();
    });

    it('revokes the object URL after clicking', () => {
        downloadFile(new Uint8Array([0x01]), 'config.iris');

        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
});
