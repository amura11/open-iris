import type { Selection } from '@model/selection.ts';
import type { State } from '@model/configurator-types.ts';

interface StateEditDialogState {
    open:         boolean;
    mode:         'create' | 'edit';
    initialState: State;
}

interface DeleteDialogState {
    open:        boolean;
    pendingName: string;
}

interface PanelState {
    width: number;
}

const BLANK_STATE: State = {
    id:              -1,
    name:            'New State',
    stateType:       'persistent',
    screenButtons:   [],
    physicalButtons: [],
    onActivate:      null,
    onDeactivate:    null,
    buttonFallback:  false,
    activeDevices:   [],
};

class UIStore {
    selection        = $state<Selection>(null);
    panel            = $state<PanelState>({ width: Math.min(600, Math.round(window.innerWidth / 3)) });
    importError      = $state<string | null>(null);
    stateEditDialog  = $state<StateEditDialogState>({ open: false, mode: 'edit', initialState: BLANK_STATE });
    deleteDialog     = $state<DeleteDialogState>({ open: false, pendingName: '' });
    deviceDialogOpen = $state<boolean>(false);

    selectButton(buttonCode: string): void {
        this.selection = { type: 'button', buttonCode };
    }

    selectScreen(): void {
        this.selection = { type: 'screen' };
    }

    clearSelection(): void {
        this.selection = null;
    }

    setPanelWidth(width: number): void {
        this.panel = { ...this.panel, width };
    }

    openStateCreate(): void {
        this.stateEditDialog = { open: true, mode: 'create', initialState: BLANK_STATE };
    }

    openStateEdit(state: State): void {
        this.stateEditDialog = { open: true, mode: 'edit', initialState: { ...state } };
    }

    closeStateEditDialog(): void {
        this.stateEditDialog = { ...this.stateEditDialog, open: false };
    }

    openDeleteDialog(stateName: string): void {
        this.deleteDialog = { open: true, pendingName: stateName };
    }

    closeDeleteDialog(): void {
        this.deleteDialog = { ...this.deleteDialog, open: false };
    }

    setImportError(message: string | null): void {
        this.importError = message;
    }
}

export const uiStore = new UIStore();
