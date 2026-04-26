#include "ui.h"
#include "esp_log.h"
#include "lvgl.h"

static const char *TAG = "ui";

// TODO: Implement LVGL widget construction from config data.
// For milestone 1: render context->items as lv_label widgets in a vertical column.

void ui_render_context(const context_t *ctx)
{
    if (!ctx) return;

    lv_obj_clean(lv_scr_act());

    for (uint16_t i = 0; i < ctx->item_count; i++) {
        ESP_LOGI(TAG, "item[%u]: %s", i, ctx->items[i].label);
        // TODO: Create lv_label at correct Y offset instead of just logging.
    }
}
