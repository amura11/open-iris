export interface LayoutRef {
    id: string;
    name: string;
    path: string;
}

export interface AppConfig {
    defaultLayout: string;
    layouts: LayoutRef[];
}

export async function loadAppConfig(): Promise<AppConfig> {
    const res = await fetch('/app-config.json');
    
    if (!res.ok) {
        throw new Error(`Failed to load app-config.json: ${res.status}`)
    };

    return res.json() as Promise<AppConfig>;
}
