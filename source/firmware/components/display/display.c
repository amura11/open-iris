#include "display.h"
#include "esp_log.h"
#include "lvgl.h"

static const char *TAG = "display";

// TODO: Implement LVGL init + ILI9341 SPI driver wiring via esp_lcd panel API.
// Reference: IDF 5.x esp_lcd + espressif/esp_lcd_ili9341 managed component.

void display_init(void)
{
    ESP_LOGI(TAG, "display_init: not yet implemented");
}

void display_tick(void)
{
    lv_timer_handler();
}
