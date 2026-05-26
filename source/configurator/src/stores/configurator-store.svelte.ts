import type { State, Device, Sequence, SequenceStep, StateId, SequenceId, DeviceId, ScreenButtonId } from '@model/configurator-types.ts';
import { ButtonCode } from '@model/button-codes.ts';
import type { WireConfig, WireIdCounters } from '@model/wire-types.ts';
import type { RemoteLayout } from '@layout/layout-types.ts';
import type { DeviceTemplate } from '@model/device-catalog-types.ts';
import { loadLayout as loadLayoutFile } from '@layout/layout-loader.ts';
import { loadAppConfig } from '../app-config.ts';
import { DeviceService } from '@services/device-service.ts';
import { ImportExportService } from '@services/import-export-service.ts';
import { FakeCatalogProvider } from '@catalog/fake-catalog-provider.ts';
import { stepToAssignment, withPhysicalButton, buildWireConfig, parseWireConfig } from '@utils/wire-config-utils.ts';

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

// ── Store ─────────────────────────────────────────────────────────────────────

export class ConfiguratorStore {
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

    // ── Physical button assignment ─────────────────────────────────────────────

    assignPhysicalButtonAction(buttonCode: ButtonCode, step: SequenceStep): void {
        const activeState = this.selectedState;
        const previousAssignment = activeState.physicalButtons.find(b => b.buttonCode === buttonCode)?.assignment ?? null;
        this.updateState({ ...activeState, physicalButtons: withPhysicalButton(activeState.physicalButtons, buttonCode, stepToAssignment(step)) });

        if (previousAssignment?.kind === 'sequence') {
            this.deleteAnonymousSequence(previousAssignment.sequenceId);
        }
    }

    assignPhysicalButtonAnonymousSequence(buttonCode: ButtonCode, steps: SequenceStep[], name: string | undefined, delayMs: number): void {
        if (steps.length === 0) {
            return;
        }

        const activeState = this.selectedState;
        const previousAssignment = activeState.physicalButtons.find(b => b.buttonCode === buttonCode)?.assignment ?? null;
        let sequenceId: number;

        if (previousAssignment?.kind === 'sequence') {
            this.updateSequence(previousAssignment.sequenceId, steps, name, delayMs);
            sequenceId = previousAssignment.sequenceId;
        } else {
            sequenceId = this.addSequence(steps, name, delayMs);
        }

        this.updateState({ ...activeState, physicalButtons: withPhysicalButton(activeState.physicalButtons, buttonCode, { kind: 'sequence', sequenceId }) });
    }

    assignPhysicalButtonNamedSequence(buttonCode: ButtonCode, sequenceId: SequenceId): void {
        const activeState = this.selectedState;
        const previousAssignment = activeState.physicalButtons.find(b => b.buttonCode === buttonCode)?.assignment ?? null;
        this.updateState({ ...activeState, physicalButtons: withPhysicalButton(activeState.physicalButtons, buttonCode, { kind: 'sequence', sequenceId }) });

        if (previousAssignment?.kind === 'sequence' && previousAssignment.sequenceId !== sequenceId) {
            this.deleteAnonymousSequence(previousAssignment.sequenceId);
        }
    }

    removePhysicalButtonAssignment(buttonCode: ButtonCode): void {
        const activeState = this.selectedState;
        const previousAssignment = activeState.physicalButtons.find(b => b.buttonCode === buttonCode)?.assignment ?? null;
        this.updateState({ ...activeState, physicalButtons: activeState.physicalButtons.filter(b => b.buttonCode !== buttonCode) });

        if (previousAssignment?.kind === 'sequence') {
            this.deleteAnonymousSequence(previousAssignment.sequenceId);
        }
    }

    // ── Screen button assignment ───────────────────────────────────────────────

    assignScreenButtonAction(screenButtonId: ScreenButtonId, step: SequenceStep): void {
        const activeState = this.selectedState;
        const previousAssignment = activeState.screenButtons.find(b => b.id === screenButtonId)?.assignment ?? null;
        this.updateState({ ...activeState, screenButtons: activeState.screenButtons.map(b => b.id === screenButtonId ? { ...b, assignment: stepToAssignment(step) } : b) });

        if (previousAssignment?.kind === 'sequence') {
            this.deleteAnonymousSequence(previousAssignment.sequenceId);
        }
    }

    assignScreenButtonAnonymousSequence(screenButtonId: ScreenButtonId, steps: SequenceStep[], name: string | undefined, delayMs: number): void {
        const activeState = this.selectedState;
        const previousAssignment = activeState.screenButtons.find(b => b.id === screenButtonId)?.assignment ?? null;
        let sequenceId: number;

        if (previousAssignment?.kind === 'sequence') {
            this.updateSequence(previousAssignment.sequenceId, steps, name, delayMs);
            sequenceId = previousAssignment.sequenceId;
        } else {
            sequenceId = this.addSequence(steps, name, delayMs);
        }

        this.updateState({ ...activeState, screenButtons: activeState.screenButtons.map(b => b.id === screenButtonId ? { ...b, assignment: { kind: 'sequence' as const, sequenceId } } : b) });
    }

    assignScreenButtonNamedSequence(screenButtonId: ScreenButtonId, sequenceId: SequenceId): void {
        const activeState = this.selectedState;
        const previousAssignment = activeState.screenButtons.find(b => b.id === screenButtonId)?.assignment ?? null;
        this.updateState({ ...activeState, screenButtons: activeState.screenButtons.map(b => b.id === screenButtonId ? { ...b, assignment: { kind: 'sequence' as const, sequenceId } } : b) });

        if (previousAssignment?.kind === 'sequence' && previousAssignment.sequenceId !== sequenceId) {
            this.deleteAnonymousSequence(previousAssignment.sequenceId);
        }
    }

    removeScreenButtonAssignment(screenButtonId: ScreenButtonId): void {
        const activeState = this.selectedState;
        const previousAssignment = activeState.screenButtons.find(b => b.id === screenButtonId)?.assignment ?? null;
        this.updateState({ ...activeState, screenButtons: activeState.screenButtons.map(b => b.id === screenButtonId ? { ...b, assignment: null } : b) });

        if (previousAssignment?.kind === 'sequence') {
            this.deleteAnonymousSequence(previousAssignment.sequenceId);
        }
    }

    // ── Wire format translation ────────────────────────────────────────────────

    toWireConfig(): WireConfig {
        return buildWireConfig(this.devices, this.sequences, this.states, this.rootStateId, this.idCounters);
    }

    loadFromWireConfig(config: WireConfig): void {
        const parsed = parseWireConfig(config);
        this.devices         = parsed.devices;
        this.sequences       = parsed.sequences;
        this.states          = parsed.states;
        this.rootStateId     = parsed.rootStateId;
        this.selectedStateId = parsed.rootStateId;
        this.idCounters      = parsed.idCounters;
    }
}

export const configuratorStore = new ConfiguratorStore();
