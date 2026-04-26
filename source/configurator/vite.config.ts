import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const layoutsDir = fileURLToPath(new URL('./layouts', import.meta.url));

/**
 * Serves the repo-root layouts/ directory as static files under /layouts/.
 * In dev: middleware on the Vite dev server.
 * In build: copies layouts/ into dist/layouts/ after the bundle is written.
 */
function layoutsPlugin() {
    return {
        name: 'openiris-layouts',
        configureServer(server: import('vite').ViteDevServer) {
            server.middlewares.use((req, res, next) => {
                if (!req.url?.startsWith('/layouts/')) {
                    return next();
                }
                const filePath = resolve(layoutsDir, req.url.slice('/layouts/'.length).split('?')[0]);
                if (!existsSync(filePath)) {
                    return next();
                }
                const mime = extname(filePath) === '.json' ? 'application/json' : 'application/octet-stream';
                res.setHeader('Content-Type', mime);
                res.end(readFileSync(filePath));
            });
        },
        closeBundle() {
            cpSync(layoutsDir, resolve(fileURLToPath(new URL('./dist/layouts', import.meta.url))), { recursive: true });
        },
    };
}

export default defineConfig({
    plugins: [svelte(), layoutsPlugin()],
    resolve: {
        alias: {
            '@components':    fileURLToPath(new URL('./src/components',    import.meta.url)),
            '@layout':        fileURLToPath(new URL('./src/layout',        import.meta.url)),
            '@model':         fileURLToPath(new URL('./src/model',         import.meta.url)),
            '@serialization': fileURLToPath(new URL('./src/serialization', import.meta.url)),
            '@styles':        fileURLToPath(new URL('./src/styles',        import.meta.url)),
        },
    },
    server: {
        host: true,
    },
});
