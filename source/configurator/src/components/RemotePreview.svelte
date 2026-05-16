<script lang="ts">
    import type { RemoteLayout } from '@layout/layout-types.ts';
    import type { RemoteConfig, State } from '@model/state.ts';
    import type { Selection } from '@model/selection.ts';
    import { assignmentLabel } from '@model/assignment-utils.ts';

    interface Props {
        layout: RemoteLayout;
        config: RemoteConfig;
        activeState: State;
        selection: Selection;
        onScreenClick?: () => void;
        onButtonClick?: (buttonCode: string) => void;
        onEmptyClick?:  () => void;
    }

    let { layout, config, activeState, selection, onScreenClick, onButtonClick, onEmptyClick }: Props = $props();

    let tooltipVisible    = $state(false);
    let tooltipLabel      = $state('');
    let tooltipAssignment = $state('');
    let tooltipX          = $state(0);
    let tooltipY          = $state(0);
    let tooltipTimer: ReturnType<typeof setTimeout> | null = null;

    let viewportEl  = $state<HTMLDivElement | undefined>();
    let transformEl = $state<HTMLDivElement | undefined>();

    // Pan / zoom state — reactive so template can read them
    let tx    = $state(0);
    let ty    = $state(0);
    let scale = $state(1);
    let isAnimating = $state(false);
    let isDragging  = $state(false);

    // Drag tracking — plain vars, not reactive (only needed inside event handlers)
    let dragMoved = false;
    let lastMx    = 0;
    let lastMy    = 0;

    // SVG natural width — set once on first fit, used to keep remote horizontally centered
    let svgNaturalWidth = 0;

    const MIN_SCALE = 0.25;
    const MAX_SCALE = 5;

    let zoomPct = $derived(Math.round(scale * 100));

    // ── Initial fit ──────────────────────────────────────────────────────────

    $effect(() => {
        if (!viewportEl || !transformEl) {
            return;
        }

        const svg = transformEl.querySelector('svg');

        if (!svg) {
            return;
        }

        applyFit(viewportEl.getBoundingClientRect(), svg.clientWidth, svg.clientHeight, false);
    });

    function applyFit(vr: { width: number; height: number }, svgW: number, svgH: number, animated: boolean) {
        svgNaturalWidth = svgW;
        const padding = 48;
        const s = Math.min((vr.width - padding * 2) / svgW, (vr.height - padding * 2) / svgH, 3);
        
        if (animated) {
            isAnimating = true;
        }

        scale = s;
        tx = (vr.width  - svgW * s) / 2;
        ty = (vr.height - svgH * s) / 2;
        if (animated) {
            setTimeout(() => {
                isAnimating = false;
            }, 420);
        }
    }

    function resetView() {
        if (!viewportEl || !transformEl) {
            return;
        }

        const svg = transformEl.querySelector('svg');

        if (!svg) {
            return;
        }

        applyFit(viewportEl.getBoundingClientRect(), svg.clientWidth, svg.clientHeight, true);
    }

    // ── Canvas click handler (button, screen, or empty area) ────────────────

    function handleCanvasClick(e: MouseEvent) {
        if (dragMoved || !transformEl) return;
        const target = e.target as Element;

        const screenEl = transformEl.querySelector(`#${layout.screen.svgElementId}`);
        if (screenEl?.contains(target)) {
            zoomToElement(screenEl);
            onScreenClick?.();
            return;
        }

        for (const btn of layout.buttons) {
            const el = transformEl.querySelector(`#${btn.svgElementId}`);
            if (el?.contains(target)) {
                zoomToElement(el);
                onButtonClick?.(btn.buttonCode);
                return;
            }
        }

        onEmptyClick?.();
    }

    // ── Button tooltips ──────────────────────────────────────────────────────

    $effect(() => {
        if (!transformEl) {
            return;
        }

        const cleanup: (() => void)[] = [];

        // Per-button tooltip on hover (500ms delay)
        for (const btn of layout.buttons) {
            const el = transformEl.querySelector(`#${btn.svgElementId}`);
            if (!el) continue;

            const enterHandler = () => {
                const pb = activeState.physicalButtons.find(p => p.buttonCode === btn.buttonCode);
                tooltipLabel      = btn.friendlyName;
                tooltipAssignment = pb ? assignmentLabel(pb.assignment, config) : 'Unassigned';
                const rect = el.getBoundingClientRect();
                const vr = viewportEl?.getBoundingClientRect();
                tooltipX = rect.left + rect.width / 2 - (vr?.left ?? 0);
                tooltipY = rect.top - (vr?.top ?? 0) - 8;
                tooltipTimer = setTimeout(() => { tooltipVisible = true; }, 300);
            };
            const leaveHandler = () => {
                if (tooltipTimer !== null) { clearTimeout(tooltipTimer); tooltipTimer = null; }
                tooltipVisible = false;
            };

            el.addEventListener('mouseenter', enterHandler);
            el.addEventListener('mouseleave', leaveHandler);
            cleanup.push(() => {
                el.removeEventListener('mouseenter', enterHandler);
                el.removeEventListener('mouseleave', leaveHandler);
            });
        }

        return () => {
            if (tooltipTimer !== null) { clearTimeout(tooltipTimer); tooltipTimer = null; }
            tooltipVisible = false;
            cleanup.forEach(fn => fn());
        };
    });

    // ── Assignment indicator ─────────────────────────────────────────────────

    $effect(() => {
        if (!transformEl) return;

        transformEl.querySelectorAll('.iris-assigned').forEach(el => el.classList.remove('iris-assigned'));

        const assignedCodes = new Set(activeState.physicalButtons.map(pb => pb.buttonCode));
        for (const btn of layout.buttons) {
            if (assignedCodes.has(btn.buttonCode)) {
                transformEl.querySelector(`#${btn.svgElementId}`)?.classList.add('iris-assigned');
            }
        }
    });

    // ── Selection highlight ──────────────────────────────────────────────────

    $effect(() => {
        if (!transformEl) {
            return;
        }

        transformEl.querySelectorAll('.iris-selected').forEach(el => el.classList.remove('iris-selected'));

        const sel = selection;

        if (!sel) {
            return;
        }

        if (sel.type === 'screen') {
            transformEl.querySelector(`#${layout.screen.svgElementId}`)?.classList.add('iris-selected');
        } else if (sel.type === 'button') {
            const btn = layout.buttons.find(b => b.buttonCode === sel.buttonCode);

            if (btn) {
                transformEl.querySelector(`#${btn.svgElementId}`)?.classList.add('iris-selected');
            }
        }
    });

    // ── Zoom to element (animated) ───────────────────────────────────────────

    function zoomToElement(el: Element) {
        if (!viewportEl) {
            return;
        }
        const vr = viewportEl.getBoundingClientRect();
        const er = el.getBoundingClientRect();

        // Element center in viewport coords (vertical only — horizontal stays centered)
        const ecy = er.top + er.height / 2 - vr.top;

        // Same point in local (pre-transform) coords
        const localY = (ecy - ty) / scale;

        // Target: the element fills ~35% of the viewport's shorter dimension
        const elSize     = Math.max(er.width, er.height);
        const targetSize = Math.min(vr.width, vr.height) * 0.35;
        const targetScale = elSize > 0
            ? Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * (targetSize / elSize)))
            : scale;

        isAnimating = true;
        tx    = (vr.width - svgNaturalWidth * targetScale) / 2;
        ty    = vr.height / 2 - localY * targetScale;
        scale = targetScale;
        setTimeout(() => {
            isAnimating = false;
        }, 420);
    }

    // ── Wheel zoom (passive:false so we can preventDefault) ─────────────────

    $effect(() => {
        if (!viewportEl) {
            return;
        }

        function onWheel(e: WheelEvent) {
            e.preventDefault();
            isAnimating = false;
            const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
            const vr = viewportEl!.getBoundingClientRect();
            const my = e.clientY - vr.top;
            const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor));
            // Horizontal: always keep remote centered; vertical: zoom around cursor
            tx    = (vr.width - svgNaturalWidth * newScale) / 2;
            ty    = my - (my - ty) * factor;
            scale = newScale;
        }
        viewportEl.addEventListener('wheel', onWheel, { passive: false });
        return () => viewportEl!.removeEventListener('wheel', onWheel);
    });

    // ── Pan (document-level so drag keeps working outside the viewport) ──────

    function handleMousedown(e: MouseEvent) {
        if (e.button !== 0) {
            return;
        }
        isDragging = true;
        dragMoved  = false;
        lastMx     = e.clientX;
        lastMy     = e.clientY;
        isAnimating = false;
        document.documentElement.style.cursor = 'grabbing';
        document.addEventListener('mousemove', onDocMousemove);
        document.addEventListener('mouseup',   onDocMouseup);
    }

    function onDocMousemove(e: MouseEvent) {
        const dx = e.clientX - lastMx;
        const dy = e.clientY - lastMy;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
            dragMoved = true;
        }
        ty += dy;
        lastMx = e.clientX;
        lastMy = e.clientY;
    }

    function onDocMouseup() {
        isDragging = false;
        document.documentElement.style.cursor = '';
        document.removeEventListener('mousemove', onDocMousemove);
        document.removeEventListener('mouseup',   onDocMouseup);
        // rAF: click events fire after mouseup in the same task; this ensures
        // click handlers can still read dragMoved before it resets
        requestAnimationFrame(() => {
            dragMoved = false;
        });
    }

    // Clean up if component is destroyed while dragging
    $effect(() => () => {
        document.documentElement.style.cursor = '';
        document.removeEventListener('mousemove', onDocMousemove);
        document.removeEventListener('mouseup',   onDocMouseup);
    });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="viewport"
    class:dragging={isDragging}
    bind:this={viewportEl}
    onmousedown={handleMousedown}
    onclick={handleCanvasClick}
>
    <div
        class="transform-layer"
        class:animating={isAnimating}
        bind:this={transformEl}
        style="transform: translate({tx}px, {ty}px) scale({scale}); transform-origin: 0 0;"
    >
        {@html layout.svgContent}
    </div>

    <div class="hud" aria-hidden="true">
        <span class="hud-zoom">{zoomPct}%</span>
        <div class="hud-divider"></div>
        <button class="hud-btn" onclick={resetView}>Fit</button>
    </div>

    <p class="hint" aria-hidden="true">Scroll to zoom · Drag to pan · Click to focus</p>

    {#if tooltipVisible}
        <div class="btn-tooltip" style="left: {tooltipX}px; top: {tooltipY}px">
            <span class="btn-tooltip-name">{tooltipLabel}</span>
            <span class="btn-tooltip-assignment">{tooltipAssignment}</span>
        </div>
    {/if}
</div>

<style>
    .viewport {
        flex: 1;
        position: relative;
        overflow: hidden;
        cursor: grab;
        user-select: none;
        /* Subtle radial gradient so the canvas feels distinct from the page bg */
        background: radial-gradient(
            ellipse at 50% 40%,
            color-mix(in srgb, var(--color-primary) 5%, var(--color-background)),
            var(--color-background) 70%
        );
    }

    .viewport.dragging { cursor: grabbing; }

    /* ── Transform layer ────────────────────────────────────────────────── */

    .transform-layer {
        position: absolute;
        top: 0;
        left: 0;
        transform-origin: 0 0;
        will-change: transform;
    }

    .transform-layer.animating {
        transition: transform 0.42s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }

    /* ── HUD (bottom-right zoom badge + fit button) ──────────────────────── */

    .hud {
        position: absolute;
        bottom: var(--sl-spacing-medium);
        right: var(--sl-spacing-medium);
        display: flex;
        align-items: center;
        gap: 0;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--sl-border-radius-medium);
        backdrop-filter: var(--surface-glass);
        font-family: var(--font-mono);
        font-size: var(--sl-font-size-x-small);
        color: var(--color-text-secondary);
        overflow: hidden;
    }

    .hud-zoom {
        padding: var(--sl-spacing-2x-small) var(--sl-spacing-small);
        min-width: 4ch;
        text-align: right;
    }

    .hud-divider {
        width: 1px;
        align-self: stretch;
        background: var(--color-border);
    }

    .hud-btn {
        all: unset;
        padding: var(--sl-spacing-2x-small) var(--sl-spacing-small);
        color: var(--color-primary);
        cursor: pointer;
        font-family: var(--font-mono);
        font-size: var(--sl-font-size-x-small);
    }

    .hud-btn:hover { color: var(--color-text-primary); }

    /* ── Hint text (bottom-left) ────────────────────────────────────────── */

    .hint {
        position: absolute;
        bottom: var(--sl-spacing-medium);
        left: var(--sl-spacing-medium);
        margin: 0;
        font-size: var(--sl-font-size-2x-small);
        font-family: var(--font-mono);
        color: var(--color-text-secondary);
        opacity: 0.5;
        pointer-events: none;
    }

    /* ── Button tooltip ─────────────────────────────────────────────────── */

    .btn-tooltip {
        position: absolute;
        transform: translateX(-50%) translateY(calc(-100% - 6px));
        display: flex;
        flex-direction: column;
        gap: 1px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--sl-border-radius-small);
        padding: 4px 10px;
        font-family: var(--font-sans);
        pointer-events: none;
        white-space: nowrap;
        z-index: 10;
        backdrop-filter: var(--surface-glass);
    }

    .btn-tooltip-name {
        font-size: var(--sl-font-size-x-small);
        font-weight: var(--sl-font-weight-semibold);
        color: var(--color-text-primary);
    }

    .btn-tooltip-assignment {
        font-size: var(--sl-font-size-2x-small);
        color: var(--color-text-secondary);
    }

    /* ── SVG borders: assigned + selected ──────────────────────────────── */

    /* Assigned (not selected): subtle primary border */
    :global(.iris-assigned:not(.iris-selected)) {
        filter:
            drop-shadow(2px 0 0 color-mix(in srgb, var(--color-primary) 45%, transparent))
            drop-shadow(-2px 0 0 color-mix(in srgb, var(--color-primary) 45%, transparent))
            drop-shadow(0 2px 0 color-mix(in srgb, var(--color-primary) 45%, transparent))
            drop-shadow(0 -2px 0 color-mix(in srgb, var(--color-primary) 45%, transparent));
    }

    /* Selected: full-strength primary border */
    :global(.iris-selected) {
        filter:
            drop-shadow(2px 0 0 var(--color-primary))
            drop-shadow(-2px 0 0 var(--color-primary))
            drop-shadow(0 2px 0 var(--color-primary))
            drop-shadow(0 -2px 0 var(--color-primary));
    }
</style>
