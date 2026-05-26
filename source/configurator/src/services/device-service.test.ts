import { describe, it, expect } from 'vitest';
import { DeviceService } from './device-service.ts';
import type { DeviceProvider, DeviceTemplate } from '@model/device-catalog-types.ts';

function makeTemplate(name: string, manufacturer: string): DeviceTemplate {
    return {
        identifier:              `${manufacturer}-${name}`,
        name,
        manufacturer,
        type:                    'ir',
        providerName:            'Test',
        allowsMultipleInstances: false,
        functions:               [],
    };
}

function makeProvider(name: string, isEnabled: boolean, results: DeviceTemplate[]): DeviceProvider {
    return {
        name,
        isEnabled,
        search: async () => results,
    };
}

describe('DeviceService.search', () => {
    it('returns results sorted by manufacturer then name', async () => {
        const templates = [
            makeTemplate('Receiver', 'Sony'),
            makeTemplate('TV', 'Apple'),
            makeTemplate('Speaker', 'Sony'),
        ];
        const service = new DeviceService([makeProvider('Test', true, templates)]);

        const results = await service.search('');

        expect(results.map(result => result.manufacturer)).toEqual(['Apple', 'Sony', 'Sony']);
        expect(results.map(result => result.name)).toEqual(['TV', 'Receiver', 'Speaker']);
    });

    it('sorts by name as tiebreaker when manufacturers are equal', async () => {
        const templates = [
            makeTemplate('Z Model', 'Sony'),
            makeTemplate('A Model', 'Sony'),
            makeTemplate('M Model', 'Sony'),
        ];
        const service = new DeviceService([makeProvider('Test', true, templates)]);

        const results = await service.search('');

        expect(results.map(result => result.name)).toEqual(['A Model', 'M Model', 'Z Model']);
    });

    it('skips disabled providers', async () => {
        const disabledProvider = makeProvider('Disabled', false, [makeTemplate('TV', 'Samsung')]);
        const enabledProvider  = makeProvider('Enabled',  true,  [makeTemplate('Amp', 'Yamaha')]);
        const service = new DeviceService([disabledProvider, enabledProvider]);

        const results = await service.search('');

        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Amp');
    });

    it('merges and sorts results from multiple enabled providers', async () => {
        const providerA = makeProvider('A', true, [makeTemplate('TV', 'LG')]);
        const providerB = makeProvider('B', true, [makeTemplate('Receiver', 'Denon')]);
        const service = new DeviceService([providerA, providerB]);

        const results = await service.search('');

        expect(results).toHaveLength(2);
        expect(results[0].manufacturer).toBe('Denon');
        expect(results[1].manufacturer).toBe('LG');
    });

    it('returns an empty array when no providers are enabled', async () => {
        const service = new DeviceService([makeProvider('Disabled', false, [makeTemplate('TV', 'Sony')])]);

        const results = await service.search('anything');

        expect(results).toHaveLength(0);
    });

    it('returns an empty array when all enabled providers return no results', async () => {
        const service = new DeviceService([makeProvider('Empty', true, [])]);

        const results = await service.search('nonexistent');

        expect(results).toHaveLength(0);
    });

    it('includes providers added via registerProvider', async () => {
        const service = new DeviceService([]);
        service.registerProvider(makeProvider('Late', true, [makeTemplate('Soundbar', 'Bose')]));

        const results = await service.search('');

        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Soundbar');
    });
});
