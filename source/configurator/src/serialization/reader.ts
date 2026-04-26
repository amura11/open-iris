import type { RemoteConfig } from '@model/context.ts';

// TODO: Implement binary reader.
// See INITIAL_BUILD_PLAN.md for the full binary format specification.
export function deserialize(_bytes: Uint8Array): RemoteConfig {
    throw new Error('reader.ts: not yet implemented');
}
