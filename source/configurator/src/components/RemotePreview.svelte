<script lang="ts">
  import type { RemoteLayout } from '@layout/layout-types.ts';
  import type { RemoteConfig } from '@model/context.ts';

  interface Props {
    layout: RemoteLayout;
    config: RemoteConfig;
    onScreenClick?: () => void;
    onButtonClick?: (buttonCode: string) => void;
  }

  let { layout, config, onScreenClick, onButtonClick }: Props = $props();

  let containerEl = $state<HTMLDivElement>();

  $effect(() => {
    if (!containerEl) return;

    const screenEl = containerEl.querySelector(`#${layout.screen.svgElementId}`);
    const cleanup: (() => void)[] = [];

    if (screenEl) {
      const handler = () => onScreenClick?.();
      screenEl.addEventListener('click', handler);
      cleanup.push(() => screenEl.removeEventListener('click', handler));
    }

    for (const btn of layout.buttons) {
      const el = containerEl.querySelector(`#${btn.svgElementId}`);
      if (el) {
        const handler = () => onButtonClick?.(btn.buttonCode);
        el.addEventListener('click', handler);
        cleanup.push(() => el.removeEventListener('click', handler));
      }
    }

    return () => cleanup.forEach(fn => fn());
  });
</script>

<!-- SVG is inlined so individual elements are accessible as real DOM nodes -->
<div bind:this={containerEl} class="d-inline-block">
  {@html layout.svgContent}
</div>
