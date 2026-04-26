#pragma once

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"

typedef struct {
    uint16_t    id;
    const char *label;      // Pointer into string_blob — do not free directly.
} item_t;

typedef struct {
    uint16_t    id;
    bool        can_activate;
    const char *name;       // Pointer into string_blob — do not free directly.
    uint16_t    item_count;
    item_t     *items;      // Pointer into contiguous item block.
    // Activity-only fields. Stubbed — will hold command sequence pointers later.
} context_t;

typedef struct {
    context_t  *contexts;
    uint16_t    context_count;
    uint16_t    root_context_id;
    char       *string_blob;    // Owns all string memory.
    uint8_t    *raw_buffer;     // Owns the entire loaded file buffer.
} config_t;

/**
 * Load a binary config file from the given path into out_config.
 * Returns ESP_OK on success. On failure, out_config is left zeroed.
 */
esp_err_t config_load(const char *path, config_t *out_config);

/** Release all memory owned by a config_t returned by config_load. */
void config_free(config_t *config);
