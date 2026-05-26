<script lang="ts">
    import { assignmentLabel } from '@utils/label-utils.ts';
    import { configuratorStore } from '@stores/configurator-store.svelte.ts';
    import { uiStore } from '@stores/ui-store.svelte.ts';

    let layout      = $derived(configuratorStore.layout!);
    let activeState = $derived(configuratorStore.selectedState);
    let selection   = $derived(uiStore.selection);

    let tooltipVisible    = $state(false);
    let tooltipLabel      = $state('');
    let tooltipAssignment = $state('');
    let tooltipX          = $state(0);
    let tooltipY          = $state(0);
    let tooltipTimer: ReturnType<typeof setTimeout> | null = null;

    let viewportEl  = $state<HTMLDivElement | undefined>();
    let transformEl = $state<HTMLDivElement | undefined>();

    let scale       = $state(1);
    let isAnimating = $state(false);

    let svgNaturalWidth  = $state(0);
    let svgNaturalHeight = $state(0);
    let viewportWidth    = $state(0);
    let viewportHeight   = $state(0);
    let hasFitInitially  = false;

    const PADDING   = 48;
    const MAX_SCALE = 5;

    let minScale = $derived(
        svgNaturalWidth > 0 && svgNaturalHeight > 0 && viewportWidth > 0 && viewportHeight > 0
            ? Math.min(
                (viewportWidth  - PADDING * 2) / svgNaturalWidth,
                (viewportHeight - PADDING * 2) / svgNaturalHeight,
                MAX_SCALE
              )
            : 1
    );

    let contentWidth  = $derived(Math.max(viewportWidth,  svgNaturalWidth  * scale + PADDING * 2));
    let contentHeight = $derived(Math.max(viewportHeight, svgNaturalHeight * scale + PADDING * 2));
    let offsetX       = $derived((contentWidth  - svgNaturalWidth  * scale) / 2);
    let offsetY       = $derived((contentHeight - svgNaturalHeight * scale) / 2);

    let zoomPct = $derived(Math.round(scale * 100));

    // ── Layout helper (used in zoom math before DOM updates) ─────────────────

    function computeContentLayout(forScale: number) {
        const newContentWidth  = Math.max(viewportWidth,  svgNaturalWidth  * forScale + PADDING * 2);
        const newContentHeight = Math.max(viewportHeight, svgNaturalHeight * forScale + PADDING * 2);

        return {
            offsetX: (newContentWidth  - svgNaturalWidth  * forScale) / 2,
            offsetY: (newContentHeight - svgNaturalHeight * forScale) / 2,
        };
    }

    // ── ResizeObserver ───────────────────────────────────────────────────────

    $effect(() => {
        if (!viewportEl) {
            return;
        }

        const observer = new ResizeObserver(entries => {
            const entry = entries[0];
            viewportWidth  = entry.contentRect.width;
            viewportHeight = entry.contentRect.height;
        });

        observer.observe(viewportEl);

        return () => observer.disconnect();
    });

    // ── Initial fit ──────────────────────────────────────────────────────────

    $effect(() => {
        if (hasFitInitially || !viewportEl || !transformEl || viewportWidth === 0 || viewportHeight === 0) {
            return;
        }

        const svg = transformEl.querySelector('svg');

        if (!svg || svg.clientWidth === 0) {
            return;
        }

        svgNaturalWidth  = svg.clientWidth;
        svgNaturalHeight = svg.clientHeight;
        hasFitInitially  = true;

        scale = Math.min(
            (viewportWidth  - PADDING * 2) / svgNaturalWidth,
            (viewportHeight - PADDING * 2) / svgNaturalHeight,
            MAX_SCALE
        );
    });

    // ── Fit / reset ──────────────────────────────────────────────────────────

    function resetView() {
        if (svgNaturalWidth === 0 || svgNaturalHeight === 0) {
            return;
        }

        isAnimating = true;
        scale = Math.min(
            (viewportWidth  - PADDING * 2) / svgNaturalWidth,
            (viewportHeight - PADDING * 2) / svgNaturalHeight,
            MAX_SCALE
        );

        setTimeout(() => {
            isAnimating = false;
        }, 420);
    }

    // ── Canvas click ─────────────────────────────────────────────────────────

    function handleCanvasClick(e: MouseEvent) {
        if (!transformEl) {
            return;
        }

        const target   = e.target as Element;
        const screenEl = transformEl.querySelector(`#${layout.screen.svgElementId}`);

        if (screenEl?.contains(target)) {
            scrollElementIntoView(screenEl);
            uiStore.selectScreen();
            return;
        }

        for (const button of layout.buttons) {
            const el = transformEl.querySelector(`#${button.svgElementId}`);

            if (el?.contains(target)) {
                scrollElementIntoView(el);
                uiStore.selectButton(button.buttonCode);
                return;
            }
        }

        uiStore.clearSelection();
    }

    // ── Scroll element into view ─────────────────────────────────────────────

    function scrollElementIntoView(el: Element) {
        if (!viewportEl) {
            return;
        }

        const SCROLL_PADDING = 24;
        const viewportRect   = viewportEl.getBoundingClientRect();
        const elementRect    = el.getBoundingClientRect();

        const relativeLeft   = elementRect.left   - viewportRect.left;
        const relativeRight  = elementRect.right  - viewportRect.left;
        const relativeTop    = elementRect.top    - viewportRect.top;
        const relativeBottom = elementRect.bottom - viewportRect.top;

        let scrollLeft = viewportEl.scrollLeft;
        let scrollTop  = viewportEl.scrollTop;

        if (relativeLeft < SCROLL_PADDING) {
            scrollLeft += relativeLeft - SCROLL_PADDING;
        } else if (relativeRight > viewportRect.width - SCROLL_PADDING) {
            scrollLeft += relativeRight - viewportRect.width + SCROLL_PADDING;
        }

        if (relativeTop < SCROLL_PADDING) {
            scrollTop += relativeTop - SCROLL_PADDING;
        } else if (relativeBottom > viewportRect.height - SCROLL_PADDING) {
            scrollTop += relativeBottom - viewportRect.height + SCROLL_PADDING;
        }

        viewportEl.scrollTo({ left: scrollLeft, top: scrollTop, behavior: 'smooth' });
    }

    // ── Ctrl+scroll to zoom ──────────────────────────────────────────────────

    $effect(() => {
        if (!viewportEl) {
            return;
        }

        function onWheel(e: WheelEvent) {
            if (!e.ctrlKey) {
                return;
            }

            e.preventDefault();
            isAnimating = false;

            const factor   = e.deltaY < 0 ? 1.12 : 1 / 1.12;
            const newScale = Math.max(minScale, Math.min(MAX_SCALE, scale * factor));

            if (newScale === scale) {
                return;
            }

            const viewportRect    = viewportEl!.getBoundingClientRect();
            const cursorViewportX = e.clientX - viewportRect.left;
            const cursorViewportY = e.clientY - viewportRect.top;
            const cursorContentX  = cursorViewportX + viewportEl!.scrollLeft;
            const cursorContentY  = cursorViewportY + viewportEl!.scrollTop;

            const currentLayout = computeContentLayout(scale);
            const svgX          = (cursorContentX - currentLayout.offsetX) / scale;
            const svgY          = (cursorContentY - currentLayout.offsetY) / scale;

            scale = newScale;

            // Defer scroll adjustment until Svelte has updated the scroll container dimensions
            requestAnimationFrame(() => {
                if (!viewportEl) {
                    return;
                }

                const newLayout = computeContentLayout(newScale);
                viewportEl.scrollLeft = Math.max(0, svgX * newScale + newLayout.offsetX - cursorViewportX);
                viewportEl.scrollTop  = Math.max(0, svgY * newScale + newLayout.offsetY - cursorViewportY);
            });
        }

        viewportEl.addEventListener('wheel', onWheel, { passive: false });

        return () => viewportEl!.removeEventListener('wheel', onWheel);
    });

    // ── Ctrl+Plus / Ctrl+Minus / Ctrl+0 ─────────────────────────────────────

    $effect(() => {
        function onKeydown(e: KeyboardEvent) {
            if (!e.ctrlKey) {
                return;
            }

            if (e.key === '=' || e.key === '+') {
                e.preventDefault();
                scale = Math.min(MAX_SCALE, scale * 1.25);
            } else if (e.key === '-') {
                e.preventDefault();
                scale = Math.max(minScale, scale / 1.25);
            } else if (e.key === '0') {
                e.preventDefault();
                resetView();
            }
        }

        document.addEventListener('keydown', onKeydown);

        return () => document.removeEventListener('keydown', onKeydown);
    });

    // ── Button tooltips ──────────────────────────────────────────────────────

    $effect(() => {
        if (!transformEl) {
            return;
        }

        const cleanup: (() => void)[] = [];

        for (const button of layout.buttons) {
            const el = transformEl.querySelector(`#${button.svgElementId}`);

            if (!el) {
                continue;
            }

            const enterHandler = () => {
                const physicalButton = activeState.physicalButtons.find(pb => pb.buttonCode === button.buttonCode);
                tooltipLabel      = button.friendlyName;
                tooltipAssignment = physicalButton
                    ? assignmentLabel(physicalButton.assignment, configuratorStore.devices, configuratorStore.sequences, configuratorStore.states)
                    : 'Unassigned';

                const elementRect  = el.getBoundingClientRect();
                const viewportRect = viewportEl?.getBoundingClientRect();
                tooltipX = elementRect.left + elementRect.width / 2 - (viewportRect?.left ?? 0);
                tooltipY = elementRect.top                           - (viewportRect?.top  ?? 0) - 8;

                tooltipTimer = setTimeout(() => { tooltipVisible = true; }, 300);
            };

            const leaveHandler = () => {
                if (tooltipTimer !== null) {
                    clearTimeout(tooltipTimer);
                    tooltipTimer = null;
                }

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
            if (tooltipTimer !== null) {
                clearTimeout(tooltipTimer);
                tooltipTimer = null;
            }

            tooltipVisible = false;
            cleanup.forEach(cleanupFunction => cleanupFunction());
        };
    });

    // ── Assignment indicator ─────────────────────────────────────────────────

    $effect(() => {
        if (!transformEl) {
            return;
        }

        transformEl.querySelectorAll('.iris-assigned').forEach(el => el.classList.remove('iris-assigned'));

        const assignedButtonCodes = new Set(activeState.physicalButtons.map(physicalButton => physicalButton.buttonCode));

        for (const button of layout.buttons) {
            if (assignedButtonCodes.has(button.buttonCode)) {
                transformEl.querySelector(`#${button.svgElementId}`)?.classList.add('iris-assigned');
            }
        }
    });

    // ── Selection highlight ──────────────────────────────────────────────────

    $effect(() => {
        if (!transformEl) {
            return;
        }

        transformEl.querySelectorAll('.iris-selected').forEach(el => el.classList.remove('iris-selected'));

        const currentSelection = selection;

        if (!currentSelection) {
            return;
        }

        if (currentSelection.type === 'screen') {
            transformEl.querySelector(`#${layout.screen.svgElementId}`)?.classList.add('iris-selected');
        } else if (currentSelection.type === 'button') {
            const button = layout.buttons.find(b => b.buttonCode === currentSelection.buttonCode);

            if (button) {
                transformEl.querySelector(`#${button.svgElementId}`)?.classList.add('iris-selected');
            }
        }
    });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="preview-root">
    <div
        class="scroll-viewport"
        bind:this={viewportEl}
        onclick={handleCanvasClick}
    >
        <div
            class="scroll-content"
            style="width: {contentWidth}px; height: {contentHeight}px;"
        >
            <div
                class="transform-layer"
                class:animating={isAnimating}
                bind:this={transformEl}
                style="left: {offsetX}px; top: {offsetY}px; transform: scale({scale}); transform-origin: 0 0;"
            >
                {@html layout.svgContent}
            </div>
        </div>
    </div>

    <nav class="hud btn-group preset-outlined-surface-200-800 font-mono text-xs" aria-hidden="true">
        <span class="btn hud-zoom">{zoomPct}%</span>
        <button class="btn hud-fit" onclick={resetView}>Fit</button>
    </nav>

    <p class="hint" aria-hidden="true">Ctrl+Scroll to zoom · Scroll to pan · Click to focus</p>

    {#if tooltipVisible}
        <div class="btn-tooltip" style="left: {tooltipX}px; top: {tooltipY}px">
            <span class="btn-tooltip-name">{tooltipLabel}</span>
            <span class="btn-tooltip-assignment">{tooltipAssignment}</span>
        </div>
    {/if}
</div>

<style>
    .preview-root {
        flex: 1;
        position: relative;
        overflow: hidden;
        background: radial-gradient(
            ellipse at 50% 40%,
            color-mix(in srgb, light-dark(var(--color-primary-600), var(--color-primary-400)) 5%, light-dark(var(--color-surface-50), var(--color-surface-900))),
            light-dark(var(--color-surface-50), var(--color-surface-900)) 70%
        );
    }

    .scroll-viewport {
        position: absolute;
        inset: 0;
        overflow: auto;
        user-select: none;
    }

    /* ── Scroll content (sizes the scrollable area to the scaled remote) ─── */

    .scroll-content {
        position: relative;
    }

    /* ── Transform layer ────────────────────────────────────────────────── */

    .transform-layer {
        position: absolute;
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
        background: color-mix(in oklab, light-dark(var(--color-surface-100), var(--color-surface-800)) 80%, transparent);
        backdrop-filter: blur(12px);
    }

    .hud-zoom {
        min-width: 4ch;
        text-align: right;
        color: light-dark(var(--color-surface-600), var(--color-surface-400));
    }

    .hud-fit {
        color: light-dark(var(--color-primary-600), var(--color-primary-400));
    }

    .hud-fit:hover { color: light-dark(var(--color-surface-900), var(--color-surface-100)); }

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

    :global(.iris-assigned:not(.iris-selected)) {
        filter:
            drop-shadow(2px 0 0 color-mix(in srgb, light-dark(var(--color-primary-600), var(--color-primary-400)) 45%, transparent))
            drop-shadow(-2px 0 0 color-mix(in srgb, light-dark(var(--color-primary-600), var(--color-primary-400)) 45%, transparent))
            drop-shadow(0 2px 0 color-mix(in srgb, light-dark(var(--color-primary-600), var(--color-primary-400)) 45%, transparent))
            drop-shadow(0 -2px 0 color-mix(in srgb, light-dark(var(--color-primary-600), var(--color-primary-400)) 45%, transparent));
    }

    :global(.iris-selected) {
        filter:
            drop-shadow(2px 0 0 light-dark(var(--color-primary-600), var(--color-primary-400)))
            drop-shadow(-2px 0 0 light-dark(var(--color-primary-600), var(--color-primary-400)))
            drop-shadow(0 2px 0 light-dark(var(--color-primary-600), var(--color-primary-400)))
            drop-shadow(0 -2px 0 light-dark(var(--color-primary-600), var(--color-primary-400)));
    }
</style>
