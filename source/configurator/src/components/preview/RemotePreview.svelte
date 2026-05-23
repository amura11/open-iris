<script lang="ts">
    import { assignmentLabel } from '@utils/label-utils.ts';
    import { configStore } from '@stores/config-store.svelte.ts';
    import { uiStore } from '@stores/ui-store.svelte.ts';

    let layout      = $derived(configStore.layout!);
    let activeState = $derived(configStore.selectedState);
    let selection   = $derived(uiStore.selection);

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
            uiStore.selectScreen();
            return;
        }

        for (const btn of layout.buttons) {
            const el = transformEl.querySelector(`#${btn.svgElementId}`);
            if (el?.contains(target)) {
                zoomToElement(el);
                uiStore.selectButton(btn.buttonCode);
                return;
            }
        }

        uiStore.clearSelection();
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
                tooltipAssignment = pb ? assignmentLabel(pb.assignment, configStore.devices, configStore.sequences, configStore.states) : 'Unassigned';
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
            color-mix(in srgb, light-dark(var(--color-primary-600), var(--color-primary-400)) 5%, light-dark(var(--color-surface-50), var(--color-surface-900))),
            light-dark(var(--color-surface-50), var(--color-surface-900)) 70%
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
        bottom: 1rem;
        right: 1rem;
        display: flex;
        align-items: center;
        gap: 0;
        background: color-mix(in oklab, light-dark(var(--color-surface-100), var(--color-surface-800)) 80%, transparent);
        border: 1px solid color-mix(in oklab, var(--color-surface-500) 40%, transparent);
        border-radius: var(--radius-base);
        backdrop-filter: blur(12px);
        font-family: monospace;
        font-size: 0.75rem;
        color: light-dark(var(--color-surface-600), var(--color-surface-400));
        overflow: hidden;
    }

    .hud-zoom {
        padding: 0.25rem 0.75rem;
        min-width: 4ch;
        text-align: right;
    }

    .hud-divider {
        width: 1px;
        align-self: stretch;
        background: color-mix(in oklab, var(--color-surface-500) 40%, transparent);
    }

    .hud-btn {
        all: unset;
        padding: 0.25rem 0.75rem;
        color: light-dark(var(--color-primary-600), var(--color-primary-400));
        cursor: pointer;
        font-family: monospace;
        font-size: 0.75rem;
    }

    .hud-btn:hover { color: light-dark(var(--color-surface-900), var(--color-surface-100)); }

    /* ── Hint text (bottom-left) ────────────────────────────────────────── */

    .hint {
        position: absolute;
        bottom: 1rem;
        left: 1rem;
        margin: 0;
        font-size: 0.625rem;
        font-family: monospace;
        color: light-dark(var(--color-surface-600), var(--color-surface-400));
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
        background: color-mix(in oklab, light-dark(var(--color-surface-100), var(--color-surface-800)) 80%, transparent);
        border: 1px solid color-mix(in oklab, var(--color-surface-500) 40%, transparent);
        border-radius: var(--radius-base);
        padding: 4px 10px;
        font-family: system-ui, sans-serif;
        pointer-events: none;
        white-space: nowrap;
        z-index: 10;
        backdrop-filter: blur(12px);
    }

    .btn-tooltip-name {
        font-size: 0.75rem;
        font-weight: 600;
        color: light-dark(var(--color-surface-900), var(--color-surface-100));
    }

    .btn-tooltip-assignment {
        font-size: 0.625rem;
        color: light-dark(var(--color-surface-600), var(--color-surface-400));
    }

    /* ── SVG borders: assigned + selected ──────────────────────────────── */

    /* Assigned (not selected): subtle primary border */
    :global(.iris-assigned:not(.iris-selected)) {
        filter:
            drop-shadow(2px 0 0 color-mix(in srgb, light-dark(var(--color-primary-600), var(--color-primary-400)) 45%, transparent))
            drop-shadow(-2px 0 0 color-mix(in srgb, light-dark(var(--color-primary-600), var(--color-primary-400)) 45%, transparent))
            drop-shadow(0 2px 0 color-mix(in srgb, light-dark(var(--color-primary-600), var(--color-primary-400)) 45%, transparent))
            drop-shadow(0 -2px 0 color-mix(in srgb, light-dark(var(--color-primary-600), var(--color-primary-400)) 45%, transparent));
    }

    /* Selected: full-strength primary border */
    :global(.iris-selected) {
        filter:
            drop-shadow(2px 0 0 light-dark(var(--color-primary-600), var(--color-primary-400)))
            drop-shadow(-2px 0 0 light-dark(var(--color-primary-600), var(--color-primary-400)))
            drop-shadow(0 2px 0 light-dark(var(--color-primary-600), var(--color-primary-400)))
            drop-shadow(0 -2px 0 light-dark(var(--color-primary-600), var(--color-primary-400)));
    }
</style>
