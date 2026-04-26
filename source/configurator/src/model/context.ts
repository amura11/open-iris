export type ItemId = number;
export type ContextId = number;

export interface Item {
    id: ItemId;
    label: string;
}

export interface Context {
    id: ContextId;
    name: string;
    canActivate: boolean;
    items: Item[];
    // Stubbed — will hold command sequences in a later milestone.
    onActivateCommands: [];
    onDeactivateCommands: [];
}

export interface RemoteConfig {
    rootContextId: ContextId;
    contexts: Context[];
}
