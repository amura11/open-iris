import { parse } from 'smol-toml';
import type { RemoteLayout } from './layout-types.ts';

interface LayoutDescriptor {
    name: string;
    svg: string;
    screen: RemoteLayout['screen'];
    buttons: RemoteLayout['buttons'];
}

export async function loadLayout(layoutTomlPath: string): Promise<RemoteLayout> {
    const response = await fetch(layoutTomlPath);
    if (!response.ok) {
        throw new Error(`Failed to load layout: ${layoutTomlPath} (${response.status})`);
    }
    const text = await response.text();
    const descriptor = parse(text) as unknown as LayoutDescriptor;
    return {
        name: descriptor.name,
        svgContent: descriptor.svg,
        screen: descriptor.screen,
        buttons: descriptor.buttons,
    };
}
