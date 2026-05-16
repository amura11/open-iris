#include "config_internal.h"
#include <stdlib.h>

esp_err_t load_section_index(iris_reader_t reader, uint32_t index_offset, uint16_t entry_count, iris_section_index_t *output)
{
    output->entry_count = entry_count;
    output->entries     = NULL;

    if (entry_count == 0) {
        return ESP_OK;
    }

    output->entries = malloc(entry_count * sizeof(iris_index_entry_t));

    if (!output->entries) {
        return ESP_ERR_NO_MEM;
    }

    uint8_t entry_bytes[INDEX_ENTRY_SIZE];

    for (uint16_t entry_index = 0; entry_index < entry_count; entry_index++) {
        esp_err_t error = reader.read(reader.context,
                                      index_offset + (uint32_t)entry_index * INDEX_ENTRY_SIZE,
                                      entry_bytes,
                                      INDEX_ENTRY_SIZE);

        if (error != ESP_OK) {
            return error;
        }

        output->entries[entry_index].id          = read_u16_le(entry_bytes);
        output->entries[entry_index].data_offset = read_u32_le(entry_bytes + 2);
        output->entries[entry_index].data_length = read_u16_le(entry_bytes + 6);
    }

    return ESP_OK;
}

const iris_index_entry_t *index_find(const iris_section_index_t *section_index, uint16_t id)
{
    int low_index  = 0;
    int high_index = (int)section_index->entry_count - 1;

    while (low_index <= high_index) {
        int mid_index = low_index + (high_index - low_index) / 2;

        if (section_index->entries[mid_index].id == id) {
            return &section_index->entries[mid_index];
        }

        if (section_index->entries[mid_index].id < id) {
            low_index = mid_index + 1;
        } else {
            high_index = mid_index - 1;
        }
    }

    return NULL;
}

void free_section_index(iris_section_index_t *section_index)
{
    free(section_index->entries);
    section_index->entries     = NULL;
    section_index->entry_count = 0;
}
