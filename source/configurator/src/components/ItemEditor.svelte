<script lang="ts">
  import type { Item } from '@model/context.ts';

  interface Props {
    item: Item;
    onSave?: (updated: Item) => void;
    onCancel?: () => void;
  }

  let { item, onSave, onCancel }: Props = $props();
  let label = $state(item.label);
</script>

<!-- TODO: Implement item editor UI -->
<div class="item-editor">
  <input bind:value={label} />
  <button onclick={() => onSave?.({ ...item, label })}>Save</button>
  <button onclick={() => onCancel?.()}>Cancel</button>
</div>
