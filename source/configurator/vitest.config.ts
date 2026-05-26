import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
    plugins: [svelte()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test-setup.ts'],
        include: ['src/**/*.test.ts', 'src/**/*.test.svelte.ts'],
    },
    resolve: {
        alias: {
            '@catalog':    fileURLToPath(new URL('./src/catalog',    import.meta.url)),
            '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
            '@layout':     fileURLToPath(new URL('./src/layout',     import.meta.url)),
            '@model':      fileURLToPath(new URL('./src/model',      import.meta.url)),
            '@services':   fileURLToPath(new URL('./src/services',   import.meta.url)),
            '@stores':     fileURLToPath(new URL('./src/stores',     import.meta.url)),
            '@styles':     fileURLToPath(new URL('./src/styles',     import.meta.url)),
            '@utils':      fileURLToPath(new URL('./src/utils',      import.meta.url)),
        },
    },
});
