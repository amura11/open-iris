# Firmware

The firmware is an ESP-IDF application for the ESP32 that reads `remote.bin` from an SD card and renders the root State's items on an ILI9341 display using LVGL.

## Status

| Feature | State |
|---|---|
| FATFS / SD card mount | Planned |
| Binary config reader (`config_load`) | Planned |
| LVGL + ILI9341 display driver | Planned |
| UI rendering from config data | Planned |
| Button input handling | Deferred |

*The firmware is not yet built. This document describes the planned design.*

## Tech Stack

- **SDK:** ESP-IDF 5.x
- **Language:** C
- **Display library:** LVGL 8.x (via `idf_component.yml` managed component)
- **Display driver:** `espressif/esp_lcd_ili9341` via `esp_lcd` panel API
- **Storage:** FATFS over SDMMC; mount point `/sdcard`
- **Target:** ESP32 (switchable to ESP32-S3 via `sdkconfig`)

## Component Breakdown

```
source/firmware/
  components/
    config/
      include/
        config.h         Public types + config_load() / config_free() API
        button_codes.h   Button code C enum (manually synced with button-codes.ts)
      config.c           Two-pass binary loader
    display/
      include/
        display.h
      display.c          LVGL init, flush callback, ILI9341 SPI setup via esp_lcd
    ui/
      include/
        ui.h
      ui.c               LVGL widget construction from state_t data
  main/
    main.c               Wiring only: mounts FATFS, calls config_load, display_init, ui_render_state
```

### `config`

Two-pass binary loader. Pass 1 reads the manifest header to compute sizes and pre-allocate contiguous blocks per type. Pass 2 fills them in. Stable numeric IDs in the file are resolved to raw pointers at load time and never used again at runtime. All string memory is owned by `string_blob` in `config_t`; pointers in `item_t` and `state_t` point into it.

```c
// config.h
typedef enum {
    STATE_TYPE_ROOT       = 0x00,
    STATE_TYPE_PERSISTENT = 0x01,
    STATE_TYPE_EPHEMERAL  = 0x02,
} state_type_t;

typedef struct { uint16_t id; const char *label; } item_t;

typedef struct {
    uint16_t id;
    state_type_t type;
    bool button_fallback;
    const char *name;
    uint16_t item_count;
    item_t *items;
    // Persistent only: on_activate / on_deactivate command sequences — stubbed
} state_t;

typedef struct {
    state_t *states;
    uint16_t state_count;
    uint16_t root_state_id;
    char *string_blob;     // owns all string memory
    uint8_t *raw_buffer;   // owns the entire loaded file buffer
} config_t;

esp_err_t config_load(const char *path, config_t *out_config);
void config_free(config_t *config);
```

### `display`

Initializes LVGL and wires up the ILI9341 via `esp_lcd`. Owns the flush callback. No other component talks to display hardware directly.

### `ui`

Takes a `state_t *` and constructs LVGL widgets. First milestone: renders items as `lv_label` widgets in a vertical column. Knows nothing about the binary format — only about the in-memory `state_t` type.

### `main`

Pure wiring: mounts FATFS at `/sdcard`, calls `config_load("/sdcard/remote.bin", &cfg)`, calls `display_init()`, calls `ui_render_state(&cfg.states[cfg.root_state_id])`. No logic lives here.

## Deferred

- Button input handling (ISRs, debouncing, button-to-action mapping)
- State activation logic (one-at-a-time Persistent state constraint)
- Navigation stack runtime implementation
- Command sequences (IR codes, macros)
- `on_activate` / `on_deactivate` execution
- LVGL themes beyond default
- Serving the configurator from the device itself
