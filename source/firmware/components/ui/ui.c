#include "ui.h"
#include "esp_log.h"
#include "lvgl.h"

static const char *TAG = "ui";

// TODO: Implement LVGL widget construction from config data.
// For milestone 1: render state->screen_buttons as lv_label widgets in a vertical column.

void ui_render_state(const iris_state_t *state)
{
    if (!state) return;

    lv_obj_clean(lv_scr_act());

    for (uint16_t i = 0; i < state->screen_button_count; i++) {
        ESP_LOGI(TAG, "button[%u]: %s", i, state->screen_buttons[i].label);
        // TODO: Create lv_label at correct Y offset instead of just logging.
    }
}
