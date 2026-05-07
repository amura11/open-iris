import type { SequenceId, Sequence, ScreenButtonConfig, PhysicalButtonConfig } from '@model/actions.ts';

export type StateId   = number;
export type StateType = 'root' | 'persistent' | 'ephemeral';

export interface State {
    id: StateId;
    name: string;
    stateType: StateType;
    screenButtons: ScreenButtonConfig[];    // ordered; determines display order
    physicalButtons: PhysicalButtonConfig[];
    onActivate: SequenceId | null;          // Persistent only; null = not configured
    onDeactivate: SequenceId | null;        // Persistent only; null = not configured
    buttonFallback: boolean;                // Ephemeral only
}

export interface RemoteConfig {
    rootStateId: StateId;
    states: State[];
    sequences: Sequence[];                  // global pool; shared across all states
}
