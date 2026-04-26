#pragma once

#include "config.h"

/**
 * Render a context's items as a vertical list of lv_label widgets.
 * Clears any existing LVGL objects on the active screen first.
 */
void ui_render_context(const context_t *ctx);
