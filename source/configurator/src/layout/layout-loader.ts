import type { RemoteLayout } from './layout-types.ts';

interface LayoutJson {
    name: string;
    svg: string;
    screen: RemoteLayout['screen'];
    buttons: RemoteLayout['buttons'];
}

export async function loadLayout(layoutJsonPath: string): Promise<RemoteLayout> {
    const response = await fetch(layoutJsonPath);
    if (!response.ok) {
        throw new Error(`Failed to load layout: ${layoutJsonPath} (${response.status})`);
    }
    const json: LayoutJson = await response.json();
    return {
        name: json.name,
        svgContent: json.svg,
        screen: json.screen,
        buttons: json.buttons,
    };
}
