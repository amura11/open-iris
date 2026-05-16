#include <stdio.h>
#include <stdlib.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "config.h"
#include "display.h"
#include "ui.h"

static const char *TAG = "main";

#define CONFIG_PATH "/sdcard/remote.bin"

static esp_err_t load_config_from_file(const char *path, iris_config_t **out_config)
{
    FILE *f = fopen(path, "rb");
    if (!f) {
        ESP_LOGE(TAG, "failed to open %s", path);
        return ESP_FAIL;
    }

    fseek(f, 0, SEEK_END);
    long file_size = ftell(f);
    fseek(f, 0, SEEK_SET);

    uint8_t *buffer = malloc((size_t)file_size);
    if (!buffer) {
        fclose(f);
        return ESP_ERR_NO_MEM;
    }

    size_t bytes_read = fread(buffer, 1, (size_t)file_size, f);
    fclose(f);

    esp_err_t err = ESP_FAIL;
    if (bytes_read == (size_t)file_size) {
        err = iris_config_load_buffer(buffer, bytes_read, out_config);
    }

    free(buffer);
    return err;
}

void app_main(void)
{
    // TODO: Mount FATFS on SD card via SDMMC peripheral before reading config.

    iris_config_t *config = NULL;
    ESP_ERROR_CHECK(load_config_from_file(CONFIG_PATH, &config));

    const iris_state_t *root = iris_config_get_root_state(config);
    if (!root) {
        ESP_LOGE(TAG, "root state not found in config");
        iris_config_free(config);
        return;
    }

    display_init();
    ui_render_state(root);

    while (1) {
        display_tick();
        vTaskDelay(pdMS_TO_TICKS(5));
    }
}
