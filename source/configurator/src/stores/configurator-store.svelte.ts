import type { State, Device, Sequence, SequenceStep, StateId, SequenceId, DeviceId } from '@model/configurator-types.ts';
import type { WireConfig, WireIdCounters, WireState, WireDevice, WireDeviceFunction, WireSequence, WireDeviceMetadata, WireFunctionMetadata, WireSequenceMetadata, WireJsonObject } from '@model/wire-types.ts';
import type { RemoteLayout } from '@layout/layout-types.ts';
import type { DeviceTemplate } from '@model/device-catalog-types.ts';
import { loadLayout as loadLayoutFile } from '@layout/layout-loader.ts';
import { loadAppConfig } from '../app-config.ts';
import {
    SYSTEM_DEVICE_ID, SYSTEM_FN_NAVIGATE, SYSTEM_FN_PAUSE, SYSTEM_FN_POWER_OFF_ACTIVE, IRIS_NO_ID,
} from '@model/serialization.ts';
import { DeviceService } from '@services/device-service.ts';
import { ImportExportService } from '@services/import-export-service.ts';
import { FakeCatalogProvider } from '@catalog/fake-catalog-provider.ts';

const DEFAULT_ROOT_STATE: State = {
    id:              0,
    name:            'Home',
    stateType:       'root',
    screenButtons:   [],
    physicalButtons: [],
    onActivate:      null,
    onDeactivate:    null,
    buttonFallback:  false,
    activeDevices:   [],
};

const DEFAULT_ID_COUNTERS: WireIdCounters = { device: 0, function: 0, sequence: 0, state: 1, dataBlock: 0 };

// ── Wire → UI conversion helpers ──────────────────────────────────────────────

function wireActionToStep(
    action: WireConfig['sequences'][number]['actions'][number],
    devices: Device[],
): SequenceStep[] {
    if (action.deviceId === SYSTEM_DEVICE_ID) {
        if (action.functionId === SYSTEM_FN_NAVIGATE) {
            return [{ kind: 'navigate', targetStateId: action.data }];
        }

        if (action.functionId === SYSTEM_FN_PAUSE) {
            return [{ kind: 'pause', durationMs: action.data }];
        }

        return [{ kind: 'power_off_active' }];
    }

    const device = devices.find(d => d.id === action.deviceId);
    const deviceFunction = device?.functions.find(f => f.id === action.functionId);

    return device && deviceFunction ? [{ kind: 'device', device, deviceFunction }] : [];
}

// ── UI → Wire conversion helpers ──────────────────────────────────────────────

export function stepToWireAction(step: SequenceStep): WireConfig['sequences'][number]['actions'][number] {
    if (step.kind === 'device') {
        return { deviceId: step.device.id, functionId: step.deviceFunction.id, data: IRIS_NO_ID };
    }

    if (step.kind === 'navigate') {
        return { deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_NAVIGATE, data: step.targetStateId };
    }

    if (step.kind === 'pause') {
        return { deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_PAUSE, data: step.durationMs };
    }

    return { deviceId: SYSTEM_DEVICE_ID, functionId: SYSTEM_FN_POWER_OFF_ACTIVE, data: IRIS_NO_ID };
}

// ── Store ─────────────────────────────────────────────────────────────────────

class ConfiguratorStore {
    devices         = $state<Device[]>([]);
    sequences       = $state<Sequence[]>([]);
    states          = $state<State[]>([DEFAULT_ROOT_STATE]);
    rootStateId     = $state<StateId>(0);
    selectedStateId = $state<StateId>(0);
    layout          = $state<RemoteLayout | null>(null);
    loadError       = $state<string | null>(null);

    readonly deviceService       = new DeviceService([new FakeCatalogProvider()]);
    readonly importExportService = new ImportExportService();

    private idCounters = $state<WireIdCounters>({ ...DEFAULT_ID_COUNTERS });

    selectedState = $derived(
        this.states.find(s => s.id === this.selectedStateId) ?? this.states[0]
    );

    // ── ID allocation ──────────────────────────────────────────────────────────

    private allocateId(idType: keyof WireIdCounters): number {
        const id = this.idCounters[idType];
        this.idCounters = { ...this.idCounters, [idType]: id + 1 };
        return id;
    }

    // ── Layout loading ─────────────────────────────────────────────────────────

    async loadLayout(): Promise<void> {
        try {
            const appConfig     = await loadAppConfig();
            const defaultLayout = appConfig.layouts.find(l => l.id === appConfig.defaultLayout);

            if (!defaultLayout) {
                throw new Error('Default layout not found in app-config.json');
            }

            this.layout = await loadLayoutFile(defaultLayout.path);
        } catch (error) {
            this.loadError = String(error);
        }
    }

    // ── State CRUD ─────────────────────────────────────────────────────────────

    selectState(stateId: StateId): void {
        this.selectedStateId = stateId;
    }

    updateState(updated: State): void {
        this.states = this.states.map(s => s.id === updated.id ? updated : s);
    }

    addState(draft: State): StateId {
        const newId = this.allocateId('state');
        this.states = [...this.states, { ...draft, id: newId }];
        return newId;
    }

    deleteState(stateId: StateId): void {
        this.states = this.states.filter(s => s.id !== stateId);
        this.selectedStateId = this.rootStateId;
    }

    // ── Sequence CRUD ──────────────────────────────────────────────────────────

    addSequence(steps: SequenceStep[], name?: string, delayMs?: number): SequenceId {
        const newId = this.allocateId('sequence');
        this.sequences = [...this.sequences, { id: newId, steps, name, delayMs: delayMs ?? 200 }];
        return newId;
    }

    updateSequence(sequenceId: SequenceId, steps: SequenceStep[], name?: string, delayMs?: number): void {
        this.sequences = this.sequences.map(s =>
            s.id === sequenceId ? { ...s, steps, name, delayMs: delayMs ?? 200 } : s
        );
    }

    deleteAnonymousSequence(sequenceId: SequenceId): void {
        const sequence = this.sequences.find(s => s.id === sequenceId);

        if (sequence?.name === undefined) {
            this.sequences = this.sequences.filter(s => s.id !== sequenceId);
        }
    }

    // ── Device CRUD ────────────────────────────────────────────────────────────

    addDevice(template: DeviceTemplate, displayName?: string): void {
        if (!template.allowsMultipleInstances && this.devices.some(d => d.sourceId === template.identifier)) {
            return;
        }

        const deviceId = this.allocateId('device');
        const functions = template.functions.map(templateFunction => ({
            id:       this.allocateId('function'),
            deviceId,
            name:     templateFunction.name,
            data:     templateFunction.data,
            sourceId: templateFunction.sourceId,
        }));

        this.devices = [...this.devices, {
            id:           deviceId,
            name:         displayName ?? template.name,
            type:         template.type,
            powerMode:    'none' as const,
            manufacturer: template.manufacturer,
            sourceId:     template.identifier,
            functions,
        }];
    }

    removeDevice(deviceId: DeviceId): void {
        this.devices = this.devices.filter(d => d.id !== deviceId);
    }

    renameDevice(deviceId: DeviceId, newName: string): void {
        this.devices = this.devices.map(d => d.id === deviceId ? { ...d, name: newName } : d);
    }

    // ── Wire format translation ────────────────────────────────────────────────

    toWireConfig(): WireConfig {
        const wireDevices: WireDevice[] = this.devices.map(device => ({
            id:                  device.id,
            name:                device.name,
            type:                device.type,
            powerMode:           device.powerMode,
            powerOnFunctionId:   device.powerOnFunctionId,
            powerOffFunctionId:  device.powerOffFunctionId,
        }));

        const wireFunctions: WireDeviceFunction[] = this.devices.flatMap(device =>
            device.functions.map(deviceFunction => ({
                id:       deviceFunction.id,
                deviceId: deviceFunction.deviceId,
                name:     deviceFunction.name,
                data:     deviceFunction.data,
            }))
        );

        const wireDeviceMetadata: WireDeviceMetadata[] = this.devices.map(device => ({
            id:           device.id,
            manufacturer: device.manufacturer,
            sourceId:     device.sourceId,
        }));

        const wireFunctionMetadata: WireFunctionMetadata[] = this.devices.flatMap(device =>
            device.functions.map(deviceFunction => ({
                id:       deviceFunction.id,
                sourceId: deviceFunction.sourceId,
            }))
        );

        const wireSequences: WireSequence[] = this.sequences.map(sequence => ({
            id:      sequence.id,
            actions: sequence.steps.map(stepToWireAction),
        }));

        const wireSequenceMetadata: WireSequenceMetadata[] = this.sequences
            .filter(sequence => sequence.name !== undefined || sequence.delayMs !== 200)
            .map(sequence => ({
                sequenceId: sequence.id,
                ...(sequence.name !== undefined ? { name: sequence.name } : {}),
                ...(sequence.delayMs !== 200    ? { delayMs: sequence.delayMs } : {}),
            }));

        const wireStates: WireState[] = this.states.map(state => ({
            id:              state.id,
            name:            state.name,
            stateType:       state.stateType,
            buttonFallback:  state.buttonFallback,
            activeDevices:   state.activeDevices,
            onActivate:      state.onActivate,
            onDeactivate:    state.onDeactivate,
            physicalButtons: state.physicalButtons.map(physicalButton => ({
                buttonCode: physicalButton.buttonCode,
                assignment: physicalButton.assignment,
            })),
            screenButtons: state.screenButtons.map(screenButton => ({
                id:         screenButton.id,
                label:      screenButton.label,
                icon:       screenButton.icon,
                assignment: screenButton.assignment,
            })),
        }));

        return {
            rootStateId: this.rootStateId,
            states:      wireStates,
            sequences:   wireSequences,
            devices:     wireDevices,
            functions:   wireFunctions,
            dataBlocks:  [],
            metadata: {
                idCounters:       this.idCounters,
                deviceMetadata:   wireDeviceMetadata,
                functionMetadata: wireFunctionMetadata,
                sequenceMetadata: wireSequenceMetadata,
                extra:            {} as WireJsonObject,
            },
        };
    }

    loadFromWireConfig(config: WireConfig): void {
        this.devices = config.devices.map(wireDevice => {
            const metadata  = config.metadata.deviceMetadata.find(m => m.id === wireDevice.id);
            const functions = config.functions
                .filter(f => f.deviceId === wireDevice.id)
                .map(wireFunction => {
                    const functionMetadata = config.metadata.functionMetadata.find(m => m.id === wireFunction.id);
                    return {
                        id:       wireFunction.id,
                        deviceId: wireFunction.deviceId,
                        name:     wireFunction.name,
                        data:     wireFunction.data,
                        sourceId: functionMetadata?.sourceId,
                    };
                });

            return {
                id:                  wireDevice.id,
                name:                wireDevice.name,
                type:                wireDevice.type,
                powerMode:           wireDevice.powerMode,
                powerOnFunctionId:   wireDevice.powerOnFunctionId,
                powerOffFunctionId:  wireDevice.powerOffFunctionId,
                manufacturer:        metadata?.manufacturer ?? '',
                sourceId:            metadata?.sourceId,
                functions,
            };
        });

        this.sequences = config.sequences.map(wireSequence => {
            const metadata = config.metadata.sequenceMetadata.find(m => m.sequenceId === wireSequence.id);
            const steps    = wireSequence.actions.flatMap(action => wireActionToStep(action, this.devices));
            return {
                id:      wireSequence.id,
                name:    metadata?.name,
                delayMs: metadata?.delayMs ?? 200,
                steps,
            };
        });

        this.states = config.states.map(wireState => ({
            id:              wireState.id,
            name:            wireState.name,
            stateType:       wireState.stateType,
            buttonFallback:  wireState.buttonFallback,
            activeDevices:   wireState.activeDevices,
            onActivate:      wireState.onActivate,
            onDeactivate:    wireState.onDeactivate,
            physicalButtons: wireState.physicalButtons.map(physicalButton => ({
                buttonCode: physicalButton.buttonCode,
                assignment: physicalButton.assignment,
            })),
            screenButtons: wireState.screenButtons.map(screenButton => ({
                id:         screenButton.id,
                label:      screenButton.label,
                icon:       screenButton.icon,
                assignment: screenButton.assignment,
            })),
        }));

        this.rootStateId     = config.rootStateId;
        this.idCounters      = config.metadata.idCounters;
        this.selectedStateId = config.rootStateId;
    }
}

export const configuratorStore = new ConfiguratorStore();
