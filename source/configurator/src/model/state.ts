export type StateId = number;
export type ItemId  = number;

export type StateType = 'root' | 'persistent' | 'ephemeral';

export interface Item {
    id: ItemId;
    label: string;
}

export interface State {
    id: StateId;
    name: string;
    stateType: StateType;
    items: Item[];
    buttonConfigs: [];        // Stubbed — will hold per-button action assignments
    onActivate: [];           // Stubbed — Persistent only; ignored on Root/Ephemeral
    onDeactivate: [];         // Stubbed — Persistent only; ignored on Root/Ephemeral
    buttonFallback: boolean;  // Ephemeral only; ignored on Root/Persistent
}

export interface RemoteConfig {
    rootStateId: StateId;
    states: State[];
}
