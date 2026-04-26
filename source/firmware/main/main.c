#include "esp_log.h"
#include "config.h"
#include "display.h"
#include "ui.h"

static const char *TAG = "main";

void app_main(void)
{
    // TODO: Mount FATFS on SD card via SDMMC peripheral.

    config_t cfg = {0};
    ESP_ERROR_CHECK(config_load("/sdcard/remote.bin", &cfg));

    display_init();

    context_t *root = NULL;
    for (uint16_t i = 0; i < cfg.context_count; i++) {
        if (cfg.contexts[i].id == cfg.root_context_id) {
            root = &cfg.contexts[i];
            break;
        }
    }

    if (root == NULL) {
        ESP_LOGE(TAG, "Root context (id=%u) not found", cfg.root_context_id);
        config_free(&cfg);
        return;
    }

    ui_render_context(root);

    // LVGL task loop
    while (1) {
        display_tick();
        vTaskDelay(pdMS_TO_TICKS(5));
    }

    config_free(&cfg);
}
