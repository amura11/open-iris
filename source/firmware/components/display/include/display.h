#pragma once

/**
 * Initialize LVGL and the ILI9341 SPI display.
 * Must be called before any LVGL draw calls.
 */
void display_init(void);

/**
 * Drive the LVGL tick/task handler.
 * Call periodically (every ~5 ms) from the main loop or a dedicated task.
 */
void display_tick(void);
