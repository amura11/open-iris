#include "config_internal.h"
#include <stdlib.h>
#include <string.h>

uint16_t read_u16_le(const uint8_t *data)
{
    return (uint16_t)(data[0] | (data[1] << 8));
}

uint32_t read_u32_le(const uint8_t *data)
{
    return (uint32_t)(data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24));
}

uint64_t read_u64_le(const uint8_t *data)
{
    uint64_t value = 0;

    for (int byte_index = 0; byte_index < 8; byte_index++) {
        value |= ((uint64_t)data[byte_index] << (8 * byte_index));
    }

    return value;
}

char *heap_copy_string(const uint8_t *source, size_t maximum_length)
{
    size_t string_length = strnlen((const char *)source, maximum_length);
    char *copy = malloc(string_length + 1);

    if (!copy) {
        return NULL;
    }

    memcpy(copy, source, string_length);
    copy[string_length] = '\0';

    return copy;
}

esp_err_t buffer_read_callback(void *context, uint32_t offset, uint8_t *output, uint16_t length)
{
    const buffer_read_context_t *buffer_context = context;

    if ((uint64_t)offset + length > buffer_context->buffer_length) {
        return ESP_ERR_INVALID_SIZE;
    }

    memcpy(output, buffer_context->buffer + offset, length);

    return ESP_OK;
}
