<script lang="ts">
    import '@shoelace-style/shoelace/dist/components/badge/badge.js';
    import '@shoelace-style/shoelace/dist/components/icon/icon.js';
    import type { ButtonDescriptor } from '@layout/layout-types.ts';

    interface Props {
        button: ButtonDescriptor;
    }

    let { button }: Props = $props();
</script>

<div class="d-flex flex-col gap-m">
    <div class="d-flex items-center gap-s">
        <span class="text-s text-muted">Button code</span>
        <sl-badge variant="neutral" pill>
            <sl-icon name="code-slash" class="text-xs"></sl-icon>
            {button.buttonCode}
        </sl-badge>
    </div>
    <p class="text-s text-muted m-0">
        Action assignment is not yet available. It will be configured in a future milestone.
    </p>
</div>
