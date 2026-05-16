#include "config_internal.h"
#include <stdlib.h>
#include <string.h>

// ── Pool freeing ──────────────────────────────────────────────────────────────

void free_device_pool(iris_config_t *config)
{
    for (uint16_t device_index = 0; device_index < config->device_count; device_index++) {
        free(config->device_pool[device_index].name);
    }

    free(config->device_pool);
    config->device_pool  = NULL;
    config->device_count = 0;
}

void free_function_pool(iris_config_t *config)
{
    for (uint16_t function_index = 0; function_index < config->function_count; function_index++) {
        iris_function_t *function_record = &config->function_pool[function_index];

        free(function_record->name);

        if (function_record->device_type == IRIS_DEVICE_TYPE_REST) {
            free(function_record->data.rest.url);
            free(function_record->data.rest.body);
        }
    }

    free(config->function_pool);
    config->function_pool  = NULL;
    config->function_count = 0;
}

void free_sequence_pool(iris_config_t *config)
{
    for (uint16_t sequence_index = 0; sequence_index < config->sequence_count; sequence_index++) {
        free(config->sequence_pool[sequence_index].actions);
    }

    free(config->sequence_pool);
    config->sequence_pool  = NULL;
    config->sequence_count = 0;
}

void free_state_pool(iris_config_t *config)
{
    for (uint16_t state_index = 0; state_index < config->state_count; state_index++) {
        iris_state_t *state_record = &config->state_pool[state_index];

        free(state_record->name);
        free(state_record->active_devices);
        free(state_record->physical_buttons);

        for (uint16_t screen_button_index = 0; screen_button_index < state_record->screen_button_count; screen_button_index++) {
            free(state_record->screen_buttons[screen_button_index].label);
        }

        free(state_record->screen_buttons);
    }

    free(config->state_pool);
    config->state_pool  = NULL;
    config->state_count = 0;
}

// ── Pool population ───────────────────────────────────────────────────────────

esp_err_t populate_device_pool(iris_reader_t reader, uint16_t device_count, iris_section_index_t *device_section_index, iris_config_t *output)
{
    if (device_count == 0) {
        return ESP_OK;
    }

    output->device_pool = calloc(device_count, sizeof(iris_device_t));

    if (!output->device_pool) {
        return ESP_ERR_NO_MEM;
    }

    output->device_count = device_count;

    for (uint16_t device_pool_index = 0; device_pool_index < device_count; device_pool_index++) {
        iris_index_entry_t *index_entry  = &device_section_index->entries[device_pool_index];
        uint8_t            *record_bytes = malloc(index_entry->data_length);

        if (!record_bytes) {
            return ESP_ERR_NO_MEM;
        }

        esp_err_t error = reader.read(reader.context, index_entry->data_offset, record_bytes, index_entry->data_length);

        if (error != ESP_OK) {
            free(record_bytes);
            return error;
        }

        iris_device_t *parsed_device = &output->device_pool[device_pool_index];
        parsed_device->id                    = read_u16_le(record_bytes);
        parsed_device->type                  = (iris_device_type_t)record_bytes[2];
        parsed_device->power_mode            = (iris_power_mode_t)record_bytes[3];
        parsed_device->power_on_function_id  = read_u16_le(record_bytes + 4);
        parsed_device->power_off_function_id = read_u16_le(record_bytes + 6);
        parsed_device->name                  = heap_copy_string(record_bytes + 8, index_entry->data_length - 8);

        free(record_bytes);

        if (!parsed_device->name) {
            return ESP_ERR_NO_MEM;
        }
    }

    return ESP_OK;
}

esp_err_t populate_function_pool(iris_reader_t reader, uint16_t function_count, iris_config_t *output)
{
    if (function_count == 0) {
        return ESP_OK;
    }

    output->function_pool = calloc(function_count, sizeof(iris_function_t));

    if (!output->function_pool) {
        return ESP_ERR_NO_MEM;
    }

    output->function_count = function_count;

    for (uint16_t function_pool_index = 0; function_pool_index < function_count; function_pool_index++) {
        iris_index_entry_t *index_entry  = &output->function_section_index.entries[function_pool_index];
        uint8_t            *record_bytes = malloc(index_entry->data_length);

        if (!record_bytes) {
            return ESP_ERR_NO_MEM;
        }

        esp_err_t error = reader.read(reader.context, index_entry->data_offset, record_bytes, index_entry->data_length);

        if (error != ESP_OK) {
            free(record_bytes);
            return error;
        }

        iris_function_t *parsed_function = &output->function_pool[function_pool_index];
        parsed_function->id        = read_u16_le(record_bytes);
        parsed_function->device_id = read_u16_le(record_bytes + 2);

        size_t name_length = strnlen((const char *)record_bytes + 4, index_entry->data_length - 4);
        parsed_function->name = malloc(name_length + 1);

        if (!parsed_function->name) {
            free(record_bytes);
            return ESP_ERR_NO_MEM;
        }

        memcpy(parsed_function->name, record_bytes + 4, name_length);
        parsed_function->name[name_length] = '\0';

        // Device type is duplicated onto the function to allow dispatch without a second lookup.
        const iris_device_t *device = iris_config_get_device(output, parsed_function->device_id);
        parsed_function->device_type = device ? device->type : IRIS_DEVICE_TYPE_IR;

        uint8_t *function_data  = record_bytes + 4 + name_length + 1;
        size_t   data_remaining = index_entry->data_length - (4 + name_length + 1);

        if (parsed_function->device_type == IRIS_DEVICE_TYPE_REST && data_remaining > 0) {
            parsed_function->data.rest.method = function_data[0];

            size_t url_length = strnlen((const char *)function_data + 1, data_remaining - 1);
            parsed_function->data.rest.url = malloc(url_length + 1);

            if (!parsed_function->data.rest.url) {
                free(record_bytes);
                return ESP_ERR_NO_MEM;
            }

            memcpy(parsed_function->data.rest.url, function_data + 1, url_length);
            parsed_function->data.rest.url[url_length] = '\0';

            size_t body_offset = 1 + url_length + 1;

            if (body_offset < data_remaining) {
                size_t body_length = strnlen((const char *)function_data + body_offset, data_remaining - body_offset);

                if (body_length > 0) {
                    parsed_function->data.rest.body = malloc(body_length + 1);

                    if (!parsed_function->data.rest.body) {
                        free(record_bytes);
                        return ESP_ERR_NO_MEM;
                    }

                    memcpy(parsed_function->data.rest.body, function_data + body_offset, body_length);
                    parsed_function->data.rest.body[body_length] = '\0';
                }
            }
        } else if (data_remaining >= 9) {
            // IR data blob: 1 byte protocol + 8 bytes little-endian code.
            parsed_function->data.ir.protocol = function_data[0];
            parsed_function->data.ir.code     = read_u64_le(function_data + 1);
        }

        free(record_bytes);
    }

    return ESP_OK;
}

esp_err_t populate_sequence_pool(iris_reader_t reader, uint16_t sequence_count, iris_config_t *output)
{
    if (sequence_count == 0) {
        return ESP_OK;
    }

    output->sequence_pool = calloc(sequence_count, sizeof(iris_sequence_t));

    if (!output->sequence_pool) {
        return ESP_ERR_NO_MEM;
    }

    output->sequence_count = sequence_count;

    for (uint16_t sequence_pool_index = 0; sequence_pool_index < sequence_count; sequence_pool_index++) {
        iris_index_entry_t *index_entry  = &output->sequence_section_index.entries[sequence_pool_index];
        uint8_t            *record_bytes = malloc(index_entry->data_length);

        if (!record_bytes) {
            return ESP_ERR_NO_MEM;
        }

        esp_err_t error = reader.read(reader.context, index_entry->data_offset, record_bytes, index_entry->data_length);

        if (error != ESP_OK) {
            free(record_bytes);
            return error;
        }

        iris_sequence_t *parsed_sequence = &output->sequence_pool[sequence_pool_index];
        parsed_sequence->id           = read_u16_le(record_bytes);
        parsed_sequence->action_count = record_bytes[2];

        if (parsed_sequence->action_count > 0) {
            parsed_sequence->actions = malloc(parsed_sequence->action_count * sizeof(iris_action_t));

            if (!parsed_sequence->actions) {
                free(record_bytes);
                return ESP_ERR_NO_MEM;
            }

            for (uint8_t action_index = 0; action_index < parsed_sequence->action_count; action_index++) {
                uint8_t *action_pointer = record_bytes + 3 + action_index * 6;
                parsed_sequence->actions[action_index].device_id   = read_u16_le(action_pointer);
                parsed_sequence->actions[action_index].function_id = read_u16_le(action_pointer + 2);
                parsed_sequence->actions[action_index].data        = read_u16_le(action_pointer + 4);
            }
        }

        free(record_bytes);
    }

    return ESP_OK;
}

esp_err_t populate_state_pool(iris_reader_t reader, uint16_t state_count, iris_config_t *output)
{
    if (state_count == 0) {
        return ESP_OK;
    }

    output->state_pool = calloc(state_count, sizeof(iris_state_t));

    if (!output->state_pool) {
        return ESP_ERR_NO_MEM;
    }

    output->state_count = state_count;

    for (uint16_t state_pool_index = 0; state_pool_index < state_count; state_pool_index++) {
        iris_index_entry_t *index_entry  = &output->state_section_index.entries[state_pool_index];
        uint8_t            *record_bytes = malloc(index_entry->data_length);

        if (!record_bytes) {
            return ESP_ERR_NO_MEM;
        }

        esp_err_t error = reader.read(reader.context, index_entry->data_offset, record_bytes, index_entry->data_length);

        if (error != ESP_OK) {
            free(record_bytes);
            return error;
        }

        iris_state_t *parsed_state  = &output->state_pool[state_pool_index];
        uint8_t      *record_cursor = record_bytes;

        parsed_state->id              = read_u16_le(record_cursor); record_cursor += 2;
        parsed_state->state_type      = (iris_state_type_t)(*record_cursor++);
        parsed_state->button_fallback = (*record_cursor++ != 0);
        parsed_state->on_activate     = read_u16_le(record_cursor); record_cursor += 2;
        parsed_state->on_deactivate   = read_u16_le(record_cursor); record_cursor += 2;

        size_t name_length = strnlen((const char *)record_cursor,
                                     (size_t)(record_bytes + index_entry->data_length - record_cursor));
        parsed_state->name = malloc(name_length + 1);

        if (!parsed_state->name) {
            free(record_bytes);
            return ESP_ERR_NO_MEM;
        }

        memcpy(parsed_state->name, record_cursor, name_length);
        parsed_state->name[name_length] = '\0';
        record_cursor += name_length + 1;

        parsed_state->active_device_count = read_u16_le(record_cursor);
        record_cursor += 2;

        if (parsed_state->active_device_count > 0) {
            parsed_state->active_devices = malloc(parsed_state->active_device_count * sizeof(iris_device_id_t));

            if (!parsed_state->active_devices) {
                free(record_bytes);
                return ESP_ERR_NO_MEM;
            }

            for (uint16_t active_device_index = 0; active_device_index < parsed_state->active_device_count; active_device_index++) {
                parsed_state->active_devices[active_device_index] = read_u16_le(record_cursor);
                record_cursor += 2;
            }
        }

        parsed_state->physical_button_count = *record_cursor++;

        if (parsed_state->physical_button_count > 0) {
            parsed_state->physical_buttons = malloc(parsed_state->physical_button_count * sizeof(iris_physical_button_t));

            if (!parsed_state->physical_buttons) {
                free(record_bytes);
                return ESP_ERR_NO_MEM;
            }

            for (uint8_t physical_button_index = 0; physical_button_index < parsed_state->physical_button_count; physical_button_index++) {
                iris_physical_button_t *button = &parsed_state->physical_buttons[physical_button_index];
                button->button_code     = *record_cursor++;
                button->assignment_type = (iris_assignment_type_t)(*record_cursor++);

                if (button->assignment_type == IRIS_ASSIGN_SEQUENCE) {
                    button->sequence_id = read_u16_le(record_cursor);
                    record_cursor += 2;
                } else {
                    button->action.device_id   = read_u16_le(record_cursor); record_cursor += 2;
                    button->action.function_id = read_u16_le(record_cursor); record_cursor += 2;
                    button->action.data        = read_u16_le(record_cursor); record_cursor += 2;
                }
            }
        }

        parsed_state->screen_button_count = read_u16_le(record_cursor);
        record_cursor += 2;

        if (parsed_state->screen_button_count > 0) {
            parsed_state->screen_buttons = malloc(parsed_state->screen_button_count * sizeof(iris_screen_button_t));

            if (!parsed_state->screen_buttons) {
                free(record_bytes);
                return ESP_ERR_NO_MEM;
            }

            for (uint16_t screen_button_index = 0; screen_button_index < parsed_state->screen_button_count; screen_button_index++) {
                iris_screen_button_t *button = &parsed_state->screen_buttons[screen_button_index];

                size_t label_length = strnlen((const char *)record_cursor,
                                              (size_t)(record_bytes + index_entry->data_length - record_cursor));
                button->label = malloc(label_length + 1);

                if (!button->label) {
                    free(record_bytes);
                    return ESP_ERR_NO_MEM;
                }

                memcpy(button->label, record_cursor, label_length);
                button->label[label_length] = '\0';
                record_cursor += label_length + 1;

                button->icon_id         = read_u16_le(record_cursor); record_cursor += 2;
                button->assignment_type = (iris_assignment_type_t)(*record_cursor++);

                if (button->assignment_type == IRIS_ASSIGN_SEQUENCE) {
                    button->sequence_id = read_u16_le(record_cursor);
                    record_cursor += 2;
                } else if (button->assignment_type == IRIS_ASSIGN_ACTION) {
                    button->action.device_id   = read_u16_le(record_cursor); record_cursor += 2;
                    button->action.function_id = read_u16_le(record_cursor); record_cursor += 2;
                    button->action.data        = read_u16_le(record_cursor); record_cursor += 2;
                }
                // IRIS_ASSIGN_UNASSIGNED: no additional data follows.
            }
        }

        free(record_bytes);
    }

    return ESP_OK;
}
