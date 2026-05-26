import { describe, it, expect } from 'vitest';
import { ImportExportService } from './import-export-service.ts';
import type { WireConfig } from '@model/wire-types.ts';
import { MAGIC, VERSION } from '@model/serialization.ts';
import { ButtonCode } from '@model/button-codes.ts';

function makeMinimalConfig(): WireConfig {
    return {
        rootStateId: 0,
        states: [{
            id:              0,
            name:            'Home',
            stateType:       'root',
            screenButtons:   [],
            physicalButtons: [],
            onActivate:      null,
            onDeactivate:    null,
            buttonFallback:  false,
            activeDevices:   [],
        }],
        sequences:  [],
        devices:    [],
        functions:  [],
        dataBlocks: [],
        metadata: {
            idCounters:       { device: 0, function: 0, sequence: 0, state: 1, dataBlock: 0 },
            deviceMetadata:   [],
            functionMetadata: [],
            sequenceMetadata: [],
            extra:            {},
        },
    };
}

describe('ImportExportService', () => {
    const service = new ImportExportService();

    // ── Error handling ──────────────────────────────────────────────────────────

    describe('deserialize — error handling', () => {
        it('throws for an invalid magic header', async () => {
            const badBytes = new Uint8Array([0x00, 0x00, 0x00, 0x00, VERSION, 0x00, 0x00]);

            await expect(service.deserialize(badBytes)).rejects.toThrow('Invalid file');
        });

        it('throws for an unsupported version', async () => {
            const badVersion = new Uint8Array([...MAGIC, 0xFF, 0x00, 0x00]);

            await expect(service.deserialize(badVersion)).rejects.toThrow('Unsupported version');
        });
    });

    // ── Round-trip ──────────────────────────────────────────────────────────────

    describe('serialize / deserialize round-trip', () => {
        it('round-trips a minimal config with a single root state', async () => {
            const original = makeMinimalConfig();
            const bytes = await service.serialize(original);
            const restored = await service.deserialize(bytes);

            expect(restored.rootStateId).toBe(0);
            expect(restored.states).toHaveLength(1);
            expect(restored.states[0].id).toBe(0);
            expect(restored.states[0].name).toBe('Home');
            expect(restored.states[0].stateType).toBe('root');
            expect(restored.states[0].buttonFallback).toBe(false);
            expect(restored.states[0].onActivate).toBeNull();
            expect(restored.states[0].onDeactivate).toBeNull();
            expect(restored.states[0].activeDevices).toEqual([]);
            expect(restored.devices).toHaveLength(0);
            expect(restored.sequences).toHaveLength(0);
        });

        it('round-trips an IR device and function', async () => {
            const original: WireConfig = {
                ...makeMinimalConfig(),
                devices: [{
                    id:       0,
                    name:     'TV',
                    type:     'ir',
                    powerMode: 'none',
                }],
                functions: [{
                    id:       0,
                    deviceId: 0,
                    name:     'Power',
                    data:     { type: 'ir', protocol: 'nec', code: BigInt(0xA1B2C3D4) },
                }],
                metadata: {
                    ...makeMinimalConfig().metadata,
                    deviceMetadata:   [{ id: 0, manufacturer: 'Sony', sourceId: 'sony-xr' }],
                    functionMetadata: [{ id: 0, sourceId: '0xa1b2c3d4' }],
                },
            };

            const bytes = await service.serialize(original);
            const restored = await service.deserialize(bytes);

            expect(restored.devices).toHaveLength(1);
            expect(restored.devices[0].name).toBe('TV');
            expect(restored.devices[0].type).toBe('ir');
            expect(restored.devices[0].powerMode).toBe('none');
            expect(restored.functions).toHaveLength(1);
            expect(restored.functions[0].name).toBe('Power');

            const functionData = restored.functions[0].data;
            expect(functionData.type).toBe('ir');

            if (functionData.type === 'ir') {
                expect(functionData.protocol).toBe('nec');
                expect(functionData.code).toBe(BigInt(0xA1B2C3D4));
            }
        });

        it('round-trips a device with power on/off functions and power mode', async () => {
            const original: WireConfig = {
                ...makeMinimalConfig(),
                devices: [{
                    id:                  0,
                    name:                'Receiver',
                    type:                'ir',
                    powerMode:           'discrete',
                    powerOnFunctionId:   0,
                    powerOffFunctionId:  1,
                }],
                functions: [
                    { id: 0, deviceId: 0, name: 'Power On',  data: { type: 'ir', protocol: 'nec', code: BigInt(0x01) } },
                    { id: 1, deviceId: 0, name: 'Power Off', data: { type: 'ir', protocol: 'nec', code: BigInt(0x02) } },
                ],
                metadata: {
                    ...makeMinimalConfig().metadata,
                    deviceMetadata:   [{ id: 0, manufacturer: 'Denon' }],
                    functionMetadata: [],
                },
            };

            const bytes = await service.serialize(original);
            const restored = await service.deserialize(bytes);

            expect(restored.devices[0].powerMode).toBe('discrete');
            expect(restored.devices[0].powerOnFunctionId).toBe(0);
            expect(restored.devices[0].powerOffFunctionId).toBe(1);
        });

        it('round-trips physical button assignments (action and sequence)', async () => {
            const original: WireConfig = {
                ...makeMinimalConfig(),
                states: [{
                    ...makeMinimalConfig().states[0],
                    physicalButtons: [
                        {
                            buttonCode: ButtonCode.VOL_UP,
                            assignment: { kind: 'action', deviceId: 0, functionId: 0, data: 0 },
                        },
                        {
                            buttonCode: ButtonCode.MUTE,
                            assignment: { kind: 'sequence', sequenceId: 0 },
                        },
                    ],
                }],
                sequences: [{ id: 0, actions: [{ deviceId: 0, functionId: 0, data: 0 }] }],
                devices:   [{ id: 0, name: 'TV', type: 'ir', powerMode: 'none' }],
                functions: [{ id: 0, deviceId: 0, name: 'Power', data: { type: 'ir', protocol: 'nec', code: BigInt(0x01) } }],
                metadata: {
                    ...makeMinimalConfig().metadata,
                    deviceMetadata: [{ id: 0, manufacturer: 'Sony' }],
                },
            };

            const bytes = await service.serialize(original);
            const restored = await service.deserialize(bytes);

            const physButtons = restored.states[0].physicalButtons;
            expect(physButtons).toHaveLength(2);
            expect(physButtons[0].buttonCode).toBe(ButtonCode.VOL_UP);
            expect(physButtons[0].assignment).toEqual({ kind: 'action', deviceId: 0, functionId: 0, data: 0 });
            expect(physButtons[1].buttonCode).toBe(ButtonCode.MUTE);
            expect(physButtons[1].assignment).toEqual({ kind: 'sequence', sequenceId: 0 });
        });

        it('round-trips screen buttons (note: ids are reassigned sequentially from 1)', async () => {
            const original: WireConfig = {
                ...makeMinimalConfig(),
                states: [{
                    ...makeMinimalConfig().states[0],
                    screenButtons: [
                        { id: 1, label: 'Play',  assignment: { kind: 'action', deviceId: 0, functionId: 0, data: 0 } },
                        { id: 2, label: 'Stop',  assignment: null },
                    ],
                }],
                devices:   [{ id: 0, name: 'TV', type: 'ir', powerMode: 'none' }],
                functions: [{ id: 0, deviceId: 0, name: 'Power', data: { type: 'ir', protocol: 'nec', code: BigInt(0x01) } }],
                metadata: {
                    ...makeMinimalConfig().metadata,
                    deviceMetadata: [{ id: 0, manufacturer: 'Sony' }],
                },
            };

            const bytes = await service.serialize(original);
            const restored = await service.deserialize(bytes);

            const screenButtons = restored.states[0].screenButtons;
            expect(screenButtons).toHaveLength(2);
            expect(screenButtons[0].label).toBe('Play');
            expect(screenButtons[0].assignment).toEqual({ kind: 'action', deviceId: 0, functionId: 0, data: 0 });
            expect(screenButtons[1].label).toBe('Stop');
            expect(screenButtons[1].assignment).toBeNull();
        });

        it('round-trips multiple states preserving types, fallback, and activate sequences', async () => {
            const original: WireConfig = {
                ...makeMinimalConfig(),
                rootStateId: 0,
                states: [
                    {
                        id:              0,
                        name:            'Home',
                        stateType:       'root',
                        screenButtons:   [],
                        physicalButtons: [],
                        onActivate:      null,
                        onDeactivate:    null,
                        buttonFallback:  true,
                        activeDevices:   [0],
                    },
                    {
                        id:              1,
                        name:            'Movie Mode',
                        stateType:       'persistent',
                        screenButtons:   [],
                        physicalButtons: [],
                        onActivate:      0,
                        onDeactivate:    null,
                        buttonFallback:  false,
                        activeDevices:   [],
                    },
                    {
                        id:              2,
                        name:            'Game Mode',
                        stateType:       'ephemeral',
                        screenButtons:   [],
                        physicalButtons: [],
                        onActivate:      null,
                        onDeactivate:    0,
                        buttonFallback:  false,
                        activeDevices:   [],
                    },
                ],
                sequences:  [{ id: 0, actions: [] }],
                devices:    [{ id: 0, name: 'TV', type: 'ir', powerMode: 'none' }],
                functions:  [],
                metadata: {
                    idCounters:       { device: 1, function: 0, sequence: 1, state: 3, dataBlock: 0 },
                    deviceMetadata:   [{ id: 0, manufacturer: 'Sony' }],
                    functionMetadata: [],
                    sequenceMetadata: [],
                    extra:            {},
                },
            };

            const bytes = await service.serialize(original);
            const restored = await service.deserialize(bytes);

            expect(restored.states).toHaveLength(3);
            expect(restored.states[0].buttonFallback).toBe(true);
            expect(restored.states[0].activeDevices).toEqual([0]);
            expect(restored.states[1].stateType).toBe('persistent');
            expect(restored.states[1].onActivate).toBe(0);
            expect(restored.states[2].stateType).toBe('ephemeral');
            expect(restored.states[2].onDeactivate).toBe(0);
        });

        it('round-trips sequence metadata (name and non-default delayMs)', async () => {
            const original: WireConfig = {
                ...makeMinimalConfig(),
                sequences: [
                    { id: 0, actions: [{ deviceId: 0xFFFF, functionId: 0x0002, data: 500 }] },
                    { id: 1, actions: [] },
                ],
                metadata: {
                    ...makeMinimalConfig().metadata,
                    sequenceMetadata: [
                        { sequenceId: 0, name: 'Startup Sequence', delayMs: 400 },
                    ],
                },
            };

            const bytes = await service.serialize(original);
            const restored = await service.deserialize(bytes);

            expect(restored.sequences).toHaveLength(2);
            expect(restored.sequences[0].id).toBe(0);
            expect(restored.sequences[0].actions).toEqual([{ deviceId: 0xFFFF, functionId: 0x0002, data: 500 }]);
            expect(restored.metadata.sequenceMetadata).toHaveLength(1);
            expect(restored.metadata.sequenceMetadata[0].name).toBe('Startup Sequence');
            expect(restored.metadata.sequenceMetadata[0].delayMs).toBe(400);
        });

        it('round-trips a REST device function', async () => {
            const original: WireConfig = {
                ...makeMinimalConfig(),
                devices:   [{ id: 0, name: 'Smart Hub', type: 'rest', powerMode: 'none' }],
                functions: [{
                    id:       0,
                    deviceId: 0,
                    name:     'Turn On Scene',
                    data:     { type: 'rest', method: 'POST', url: 'http://hub.local/api/scene', body: '{"scene":"on"}' },
                }],
                metadata: {
                    ...makeMinimalConfig().metadata,
                    deviceMetadata: [{ id: 0, manufacturer: 'Philips' }],
                },
            };

            const bytes = await service.serialize(original);
            const restored = await service.deserialize(bytes);

            expect(restored.functions[0].name).toBe('Turn On Scene');

            const functionData = restored.functions[0].data;
            expect(functionData.type).toBe('rest');

            if (functionData.type === 'rest') {
                expect(functionData.method).toBe('POST');
                expect(functionData.url).toBe('http://hub.local/api/scene');
                expect(functionData.body).toBe('{"scene":"on"}');
            }
        });
    });
});
