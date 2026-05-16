#include "config_internal.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "esp_log.h"

static const char *TAG = "iris_config";

static const uint8_t IRIS_MAGIC[4] = { 0x49, 0x52, 0x49, 0x53 };  // "IRIS"

typedef struct {
    uint8_t  type_tag;
    uint16_t record_count;
    uint32_t index_offset;
    uint32_t data_offset;
} manifest_section_t;

// ── Load sub-steps ────────────────────────────────────────────────────────────

static esp_err_t validate_header(iris_reader_t reader, uint16_t *root_state_id_output)
{
    uint8_t header_bytes[HEADER_SIZE];
    esp_err_t error = reader.read(reader.context, 0, header_bytes, HEADER_SIZE);

    if (error != ESP_OK) {
        return error;
    }

    if (memcmp(header_bytes, IRIS_MAGIC, 4) != 0) {
        ESP_LOGE(TAG, "invalid magic bytes");
        return ESP_ERR_INVALID_ARG;
    }

    if (header_bytes[4] != IRIS_VERSION) {
        ESP_LOGE(TAG, "unsupported version 0x%02x (expected 0x%02x)", header_bytes[4], IRIS_VERSION);
        return ESP_ERR_INVALID_VERSION;
    }

    *root_state_id_output = read_u16_le(header_bytes + 5);

    return ESP_OK;
}

static esp_err_t read_manifest(iris_reader_t reader, uint16_t *section_count_output, manifest_section_t **sections_output)
{
    uint8_t section_count_bytes[2];
    esp_err_t error = reader.read(reader.context, HEADER_SIZE, section_count_bytes, 2);

    if (error != ESP_OK) {
        return error;
    }

    uint16_t section_count = read_u16_le(section_count_bytes);

    manifest_section_t *sections = malloc(section_count * sizeof(manifest_section_t));

    if (!sections) {
        return ESP_ERR_NO_MEM;
    }

    uint32_t manifest_base_offset = HEADER_SIZE + 2;
    uint8_t  manifest_entry_bytes[MANIFEST_ENTRY_SIZE];

    for (uint16_t manifest_entry_index = 0; manifest_entry_index < section_count; manifest_entry_index++) {
        error = reader.read(reader.context,
                            manifest_base_offset + (uint32_t)manifest_entry_index * MANIFEST_ENTRY_SIZE,
                            manifest_entry_bytes,
                            MANIFEST_ENTRY_SIZE);

        if (error != ESP_OK) {
            free(sections);
            return error;
        }

        sections[manifest_entry_index].type_tag     = manifest_entry_bytes[0];
        sections[manifest_entry_index].record_count = read_u16_le(manifest_entry_bytes + 1);
        sections[manifest_entry_index].index_offset = read_u32_le(manifest_entry_bytes + 3);
        sections[manifest_entry_index].data_offset  = read_u32_le(manifest_entry_bytes + 7);
    }

    *section_count_output = section_count;
    *sections_output      = sections;

    return ESP_OK;
}

static esp_err_t load_section_indexes(iris_reader_t reader,
                                      uint16_t section_count,
                                      const manifest_section_t *sections,
                                      iris_config_t *output,
                                      iris_section_index_t *device_section_index_output,
                                      uint16_t *device_count_output,
                                      uint16_t *function_count_output,
                                      uint16_t *sequence_count_output,
                                      uint16_t *state_count_output)
{
    *device_count_output   = 0;
    *function_count_output = 0;
    *sequence_count_output = 0;
    *state_count_output    = 0;

    for (uint16_t section_index = 0; section_index < section_count; section_index++) {
        const manifest_section_t *section_entry = &sections[section_index];
        esp_err_t error = ESP_OK;

        switch (section_entry->type_tag) {
            case TAG_DEVICES:
                *device_count_output = section_entry->record_count;
                error = load_section_index(reader, section_entry->index_offset, section_entry->record_count, device_section_index_output);
                break;
            case TAG_FUNCTIONS:
                *function_count_output = section_entry->record_count;
                error = load_section_index(reader, section_entry->index_offset, section_entry->record_count, &output->function_section_index);
                break;
            case TAG_SEQS:
                *sequence_count_output = section_entry->record_count;
                error = load_section_index(reader, section_entry->index_offset, section_entry->record_count, &output->sequence_section_index);
                break;
            case TAG_STATES:
                *state_count_output = section_entry->record_count;
                error = load_section_index(reader, section_entry->index_offset, section_entry->record_count, &output->state_section_index);
                break;
            case TAG_DATA_BLOCKS:
                error = load_section_index(reader, section_entry->index_offset, section_entry->record_count, &output->data_blocks_section_index);
                break;
            default:
                break;  // unknown section types are silently skipped
        }

        if (error != ESP_OK) {
            return error;
        }
    }

    return ESP_OK;
}

// ── Public API ────────────────────────────────────────────────────────────────

void iris_config_free(iris_config_t *config)
{
    if (!config) {
        return;
    }

    free_device_pool(config);
    free_function_pool(config);
    free_sequence_pool(config);
    free_state_pool(config);
    free_section_index(&config->state_section_index);
    free_section_index(&config->sequence_section_index);
    free_section_index(&config->function_section_index);
    free_section_index(&config->data_blocks_section_index);
    memset(config, 0, sizeof(*config));
}

esp_err_t iris_config_load(iris_reader_t reader, iris_config_t *output)
{
    memset(output, 0, sizeof(*output));
    output->reader = reader;

    esp_err_t error = validate_header(reader, &output->root_state_id);

    if (error != ESP_OK) {
        return error;
    }

    uint16_t            section_count;
    manifest_section_t *manifest_sections;

    error = read_manifest(reader, &section_count, &manifest_sections);

    if (error != ESP_OK) {
        return error;
    }

    iris_section_index_t device_section_index = {0};
    uint16_t device_count   = 0;
    uint16_t function_count = 0;
    uint16_t sequence_count = 0;
    uint16_t state_count    = 0;

    error = load_section_indexes(reader, section_count, manifest_sections, output,
                                 &device_section_index, &device_count, &function_count, &sequence_count, &state_count);
    free(manifest_sections);

    if (error != ESP_OK) {
        free_section_index(&device_section_index);
        iris_config_free(output);
        return error;
    }

    // Devices must be populated before functions — function parsing needs device type.
    error = populate_device_pool(reader, device_count, &device_section_index, output);
    free_section_index(&device_section_index);

    if (error != ESP_OK) {
        iris_config_free(output);
        return error;
    }

    error = populate_function_pool(reader, function_count, output);

    if (error != ESP_OK) {
        iris_config_free(output);
        return error;
    }

    error = populate_sequence_pool(reader, sequence_count, output);

    if (error != ESP_OK) {
        iris_config_free(output);
        return error;
    }

    error = populate_state_pool(reader, state_count, output);

    if (error != ESP_OK) {
        iris_config_free(output);
        return error;
    }

    ESP_LOGI(TAG, "loaded: %u devices, %u functions, %u sequences, %u states",
             output->device_count, output->function_count, output->sequence_count, output->state_count);

    return ESP_OK;
}

esp_err_t iris_config_load_buffer(const uint8_t *buffer, size_t buffer_length, iris_config_t *output)
{
    buffer_read_context_t buffer_context = { .buffer = buffer, .buffer_length = buffer_length };
    iris_reader_t reader = { .read = buffer_read_callback, .context = &buffer_context };
    esp_err_t error = iris_config_load(reader, output);

    // Clear reader after eager load — all records are in pools, reader not needed.
    output->reader = (iris_reader_t){0};

    return error;
}

// ── Getters ───────────────────────────────────────────────────────────────────

const iris_device_t *iris_config_get_device(iris_config_t *config, iris_device_id_t id)
{
    for (uint16_t device_index = 0; device_index < config->device_count; device_index++) {
        if (config->device_pool[device_index].id == id) {
            return &config->device_pool[device_index];
        }
    }

    return NULL;
}

const iris_function_t *iris_config_get_function(iris_config_t *config, iris_function_id_t id)
{
    for (uint16_t function_index = 0; function_index < config->function_count; function_index++) {
        if (config->function_pool[function_index].id == id) {
            return &config->function_pool[function_index];
        }
    }

    return NULL;
}

const iris_sequence_t *iris_config_get_sequence(iris_config_t *config, iris_sequence_id_t id)
{
    for (uint16_t sequence_index = 0; sequence_index < config->sequence_count; sequence_index++) {
        if (config->sequence_pool[sequence_index].id == id) {
            return &config->sequence_pool[sequence_index];
        }
    }

    return NULL;
}

const iris_state_t *iris_config_get_state(iris_config_t *config, iris_state_id_t id)
{
    for (uint16_t state_index = 0; state_index < config->state_count; state_index++) {
        if (config->state_pool[state_index].id == id) {
            return &config->state_pool[state_index];
        }
    }

    return NULL;
}
