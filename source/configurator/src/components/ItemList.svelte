<script lang="ts">
  import type { Context } from '@model/context.ts';

  interface Props {
    context: Context;
    onUpdate?: (updated: Context) => void;
  }

  let { context, onUpdate }: Props = $props();
</script>

<!-- TODO: Implement item list UI (add / rename / remove) -->
<ul>
  {#each context.items as item (item.id)}
    <li>{item.label}</li>
  {/each}
</ul>
