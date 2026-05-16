#pragma once

#include "config.h"
#include <stddef.h>
#include <stdint.h>
#include "esp_err.h"

// ── Section index ─────────────────────────────────────────────────────────────

typedef struct {
    uint16_t id;
    uint32_t data_offset;  // absolute byte offset in the source
    uint16_t data_length;
} iris_index_entry_t;      // 8 bytes — matches INDEX_ENTRY_SIZE in the binary format

typedef struct {
    iris_index_entry_t *entries;  // heap-allocated; sorted ascending by id
    uint16_t entry_count;
} iris_section_index_t;

// ── Config struct (opaque to callers; heap-allocated by iris_config_load) ─────

struct iris_config_t {
    iris_state_id_t root_state_id;
    iris_reader_t reader;
    iris_section_index_t state_section_index;
    iris_section_index_t sequence_section_index;
    iris_section_index_t function_section_index;
    iris_section_index_t data_blocks_section_index;
    iris_device_t *device_pool;
    uint16_t device_count;
    iris_function_t *function_pool;
    uint16_t function_count;
    iris_sequence_t *sequence_pool;
    uint16_t sequence_count;
    iris_state_t *state_pool;
    uint16_t state_count;
};

// ── Binary format constants ───────────────────────────────────────────────────

#define IRIS_VERSION         0x05
#define TAG_STATES           0x01
#define TAG_SEQS             0x02
#define TAG_DEVICES          0x03
#define TAG_FUNCTIONS        0x04
#define TAG_DATA_BLOCKS      0x05
#define HEADER_SIZE          7
#define MANIFEST_ENTRY_SIZE  11
#define INDEX_ENTRY_SIZE     8

// ── Byte reading utilities (config_util.c) ────────────────────────────────────

uint16_t read_u16_le(const uint8_t *data);
uint32_t read_u32_le(const uint8_t *data);
uint64_t read_u64_le(const uint8_t *data);

// Copies the null-terminated string at source into a new heap allocation.
char *heap_copy_string(const uint8_t *source, size_t maximum_length);

// ── Buffer-backed reader (config_util.c) ──────────────────────────────────────

typedef struct {
    const uint8_t *buffer;
    size_t buffer_length;
} buffer_read_context_t;

esp_err_t buffer_read_callback(void *context, uint32_t offset, uint8_t *output, uint16_t length);

// ── Section index operations (config_index.c) ─────────────────────────────────

esp_err_t load_section_index(iris_reader_t reader, uint32_t index_offset, uint16_t entry_count, iris_section_index_t *output);
const iris_index_entry_t *index_find(const iris_section_index_t *section_index, uint16_t id);
void free_section_index(iris_section_index_t *section_index);

// ── Pool freeing (config_pool.c) ──────────────────────────────────────────────

void free_device_pool(iris_config_t *config);
void free_function_pool(iris_config_t *config);
void free_sequence_pool(iris_config_t *config);
void free_state_pool(iris_config_t *config);

// ── Pool population (config_pool.c) ───────────────────────────────────────────
// Each function allocates its pool with calloc and populates it. On failure,
// the pool is left partially filled; the caller must call iris_config_free to
// release all pools that were already allocated.

esp_err_t populate_device_pool(iris_reader_t reader, uint16_t device_count, iris_section_index_t *device_section_index, iris_config_t *output);
esp_err_t populate_function_pool(iris_reader_t reader, uint16_t function_count, iris_config_t *output);
esp_err_t populate_sequence_pool(iris_reader_t reader, uint16_t sequence_count, iris_config_t *output);
esp_err_t populate_state_pool(iris_reader_t reader, uint16_t state_count, iris_config_t *output);
