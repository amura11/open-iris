import type { State, RemoteConfig, DeviceMetadata, FunctionMetadata } from '@model/state.ts';
import type { Device, DeviceId, DeviceFunction } from '@model/devices.ts';
import type { CatalogDevice } from '@catalog/catalog-source.ts';
import { consumeId } from '@model/assignment-utils.ts';

const DEFAULT_CONFIG: RemoteConfig = {
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

class ConfigStore {
    remoteConfig    = $state<RemoteConfig>(DEFAULT_CONFIG);
    selectedStateId = $state<number>(0);
    selectedState   = $derived(
        this.remoteConfig.states.find(s => s.id === this.selectedStateId)
        ?? this.remoteConfig.states[0]
    );

    selectState(stateId: number): void {
        this.selectedStateId = stateId;
    }

    // Updates a single state within the config, identified by its id.
    updateState(updated: State): void {
        this.remoteConfig = {
            ...this.remoteConfig,
            states: this.remoteConfig.states.map(s => s.id === updated.id ? updated : s),
        };
    }

    // Allocates a new state ID, inserts the state, and returns the new ID.
    addState(draft: State): number {
        const [newId, configWithId] = consumeId(this.remoteConfig, 'state');
        const newState: State = { ...draft, id: newId };
        this.remoteConfig = { ...configWithId, states: [...configWithId.states, newState] };
        return newId;
    }

    // Removes a state and resets selection to the root state.
    deleteState(stateId: number): void {
        this.remoteConfig = {
            ...this.remoteConfig,
            states: this.remoteConfig.states.filter(s => s.id !== stateId),
        };
        this.selectedStateId = this.remoteConfig.rootStateId;
    }

    // Replaces the entire config, preserving the current selection if it still exists.
    replaceConfig(updated: RemoteConfig): void {
        this.remoteConfig = updated;
        if (!updated.states.some(s => s.id === this.selectedStateId)) {
            this.selectedStateId = updated.rootStateId;
        }
    }

    // Replaces the config and always resets selection to the root state (used on import).
    loadConfig(config: RemoteConfig): void {
        this.remoteConfig   = config;
        this.selectedStateId = config.rootStateId;
    }

    addDevice(catalogDevice: CatalogDevice): void {
        if (this.remoteConfig.metadata.deviceMetadata.some(m => m.sourceId === catalogDevice.sourceId)) {
            return;
        }

        let config = this.remoteConfig;
        const [deviceId, afterDevice] = consumeId(config, 'device');
        config = afterDevice;

        const newDevice: Device = {
            id:        deviceId,
            name:      catalogDevice.name,
            type:      catalogDevice.type,
            powerMode: 'none',
        };

        const newFunctions: DeviceFunction[]  = [];
        const newFunctionMeta: FunctionMetadata[] = [];

        for (const catalogFn of catalogDevice.functions) {
            const [fnId, afterFn] = consumeId(config, 'function');
            config = afterFn;
            newFunctions.push({ id: fnId, deviceId, name: catalogFn.name, data: catalogFn.data });
            newFunctionMeta.push({ id: fnId, sourceId: catalogFn.sourceId });
        }

        const newDeviceMeta: DeviceMetadata = {
            id:           deviceId,
            manufacturer: catalogDevice.manufacturer,
            sourceId:     catalogDevice.sourceId,
        };

        this.remoteConfig = {
            ...config,
            devices:   [...config.devices,   newDevice],
            functions: [...config.functions,  ...newFunctions],
            metadata: {
                ...config.metadata,
                deviceMetadata:   [...config.metadata.deviceMetadata,   newDeviceMeta],
                functionMetadata: [...config.metadata.functionMetadata, ...newFunctionMeta],
            },
        };
    }

    removeDevice(deviceId: DeviceId): void {
        const removedFunctionIds = new Set(
            this.remoteConfig.functions.filter(f => f.deviceId === deviceId).map(f => f.id)
        );
        this.remoteConfig = {
            ...this.remoteConfig,
            devices:   this.remoteConfig.devices.filter(d => d.id !== deviceId),
            functions: this.remoteConfig.functions.filter(f => f.deviceId !== deviceId),
            metadata: {
                ...this.remoteConfig.metadata,
                deviceMetadata:   this.remoteConfig.metadata.deviceMetadata.filter(m => m.id !== deviceId),
                functionMetadata: this.remoteConfig.metadata.functionMetadata.filter(m => !removedFunctionIds.has(m.id)),
            },
        };
    }
}

export const configStore = new ConfigStore();
