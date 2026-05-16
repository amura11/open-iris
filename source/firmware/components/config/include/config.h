#pragma once

#include "iris_types.h"
#include "esp_err.h"

// ── Abstract I/O ─────────────────────────────────────────────────────────────

// Read `length` bytes from absolute byte offset `offset` into `output`.
typedef esp_err_t (*iris_read_fn_t)(void *context, uint32_t offset, uint8_t *output, uint16_t length);

// A reader bundles a read callback with the opaque context it needs to operate.
// Callers supply a concrete reader (buffer-backed, SPIFFS, SD, etc.); the config
// component calls through it without knowing the underlying source.
typedef struct
{
    iris_read_fn_t read;
    void *context;
} iris_reader_t;

// ── Config handle (opaque) ────────────────────────────────────────────────────

typedef struct iris_config_t iris_config_t;

// ── Loading ───────────────────────────────────────────────────────────────────

esp_err_t iris_config_load(iris_reader_t reader, iris_config_t **out_config);
esp_err_t iris_config_load_buffer(const uint8_t *buffer, size_t buffer_length, iris_config_t **out_config);
void iris_config_free(iris_config_t *config);

// ── Getters — NULL means not found ───────────────────────────────────────────

const iris_state_t *iris_config_get_root_state(iris_config_t *config);
const iris_device_t *iris_config_get_device(iris_config_t *config, iris_device_id_t id);
const iris_function_t *iris_config_get_function(iris_config_t *config, iris_function_id_t id);
const iris_sequence_t *iris_config_get_sequence(iris_config_t *config, iris_sequence_id_t id);
const iris_state_t *iris_config_get_state(iris_config_t *config, iris_state_id_t id);

// ── Action execution ──────────────────────────────────────────────────────────

esp_err_t iris_run_action(iris_config_t *config, const iris_action_t *action);
esp_err_t iris_run_sequence(iris_config_t *config, iris_sequence_id_t sequence_id);
esp_err_t iris_run_physical_button(iris_config_t *config, const iris_physical_button_t *button);
esp_err_t iris_run_screen_button(iris_config_t *config, const iris_screen_button_t *button);
