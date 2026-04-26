<script lang="ts">
  import type { ButtonDescriptor } from '@layout/layout-types.ts';

  interface Props {
    button: ButtonDescriptor;
    onClose?: () => void;
  }

  let { button, onClose }: Props = $props();
</script>

<!-- TODO: Implement button action assignment UI (stubbed for milestone 1) -->
<div class="button-action-dialog">
  <h3>{button.friendlyName}</h3>
  <p>Button code: <code>{button.buttonCode}</code></p>
  <p><em>Action assignment coming in a later milestone.</em></p>
  <button onclick={() => onClose?.()}>Close</button>
</div>
