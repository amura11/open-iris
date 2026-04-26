<script lang="ts">
  import type { Context } from '@model/context.ts';
  import ItemList from '@components/ItemList.svelte';

  interface Props {
    context: Context;
    onUpdate?: (updated: Context) => void;
    onClose?: () => void;
  }

  let { context, onUpdate, onClose }: Props = $props();
</script>

<!-- TODO: Implement context editor UI -->
<div class="context-editor">
  <h2>{context.name}</h2>
  <ItemList {context} onUpdate={onUpdate} />
  <button onclick={() => onClose?.()}>Close</button>
</div>
