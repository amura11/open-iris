import type { CatalogDevice, DeviceProvider } from '@model/device-catalog-types.ts';

export class DeviceService {
    private registeredProviders: DeviceProvider[];

    constructor(providers: DeviceProvider[]) {
        this.registeredProviders = providers;
    }

    registerProvider(provider: DeviceProvider): void {
        this.registeredProviders.push(provider);
    }

    async search(query: string): Promise<CatalogDevice[]> {
        const enabledProviders = this.registeredProviders.filter(provider => provider.isEnabled);
        const resultSets = await Promise.all(enabledProviders.map(provider => provider.search(query)));
        const combinedResults = resultSets.flat();

        return combinedResults.sort((first, second) => {
            const manufacturerComparison = first.manufacturer.localeCompare(second.manufacturer);

            if (manufacturerComparison !== 0) {
                return manufacturerComparison;
            }

            return first.name.localeCompare(second.name);
        });
    }
}
