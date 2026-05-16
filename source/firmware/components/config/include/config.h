#pragma once

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"

// ── Sentinel ──────────────────────────────────────────────────────────────────

#define IRIS_NO_ID  UINT16_MAX   // 0xFFFF — "not set" for any uint16 ID

// ── System functions — device ID 0xFFFF means system; function ID selects which ──

#define IRIS_SYSTEM_DEVICE_ID         UINT16_MAX   // 0xFFFF
#define IRIS_SYS_FN_NAVIGATE          0x0001
#define IRIS_SYS_FN_PAUSE             0x0002
#define IRIS_SYS_FN_POWER_OFF_ACTIVE  0x0003

// ── Type aliases ──────────────────────────────────────────────────────────────

typedef uint16_t iris_device_id_t;
typedef uint16_t iris_function_id_t;
typedef uint16_t iris_sequence_id_t;
typedef uint16_t iris_state_id_t;
typedef uint16_t iris_data_block_id_t;

// ── Enumerations ──────────────────────────────────────────────────────────────

typedef enum {
    IRIS_DEVICE_TYPE_IR     = 0x01,
    IRIS_DEVICE_TYPE_REST   = 0x02,
    IRIS_DEVICE_TYPE_MATTER = 0x03,
} iris_device_type_t;

typedef enum {
    IRIS_POWER_MODE_NONE     = 0x00,
    IRIS_POWER_MODE_TOGGLE   = 0x01,
    IRIS_POWER_MODE_DISCRETE = 0x02,
} iris_power_mode_t;

typedef enum {
    IRIS_ASSIGN_UNASSIGNED = 0x00,   // only valid for screen buttons
    IRIS_ASSIGN_SEQUENCE   = 0x01,
    IRIS_ASSIGN_ACTION     = 0x02,
} iris_assignment_type_t;

typedef enum {
    IRIS_STATE_ROOT       = 0x00,
    IRIS_STATE_PERSISTENT = 0x01,
    IRIS_STATE_EPHEMERAL  = 0x02,
} iris_state_type_t;

// ── Action (6 bytes, packed) ──────────────────────────────────────────────────

typedef struct __attribute__((packed)) {
    iris_device_id_t    device_id;
    iris_function_id_t  function_id;
    uint16_t            data;        // inline value or data_block_id; IRIS_NO_ID if unused
} iris_action_t;

// ── Device ────────────────────────────────────────────────────────────────────

typedef struct {
    iris_device_id_t    id;
    iris_device_type_t  type;
    iris_power_mode_t   power_mode;
    iris_function_id_t  power_on_function_id;    // IRIS_NO_ID if not set
    iris_function_id_t  power_off_function_id;   // IRIS_NO_ID if not set
    char               *name;                    // heap-allocated, null-terminated
} iris_device_t;

// ── Parsed function data (one variant per device type) ───────────────────────

typedef struct {
    uint8_t   protocol;   // IRIS_IR_PROTOCOL_* byte
    uint64_t  code;       // parsed little-endian uint64
} iris_ir_data_t;

typedef struct {
    uint8_t  method;   // 0x01=GET  0x02=POST  0x03=PUT  0x04=DELETE
    char    *url;      // heap-allocated, null-terminated
    char    *body;     // heap-allocated, null-terminated; NULL if empty
} iris_rest_data_t;

// ── Parsed function ───────────────────────────────────────────────────────────

typedef struct {
    iris_function_id_t  id;
    iris_device_id_t    device_id;
    iris_device_type_t  device_type;   // duplicated from device for dispatch without lookup
    char               *name;          // heap-allocated, null-terminated
    union {
        iris_ir_data_t   ir;
        iris_rest_data_t rest;
    } data;
} iris_function_t;

// ── Parsed sequence ───────────────────────────────────────────────────────────

typedef struct {
    iris_sequence_id_t  id;
    uint8_t             action_count;
    iris_action_t      *actions;       // heap-allocated array
} iris_sequence_t;

// ── Loaded button configs ─────────────────────────────────────────────────────

typedef struct {
    uint8_t                button_code;
    iris_assignment_type_t assignment_type;
    union {
        iris_sequence_id_t sequence_id;
        iris_action_t      action;
    };
} iris_physical_button_t;

typedef struct {
    char                  *label;            // heap-allocated, null-terminated
    uint16_t               icon_id;          // IRIS_NO_ID if not set
    iris_assignment_type_t assignment_type;  // IRIS_ASSIGN_UNASSIGNED if not configured
    union {
        iris_sequence_id_t sequence_id;
        iris_action_t      action;
    };
} iris_screen_button_t;

// ── Loaded state ──────────────────────────────────────────────────────────────

typedef struct {
    iris_state_id_t         id;
    iris_state_type_t       state_type;
    bool                    button_fallback;
    iris_sequence_id_t      on_activate;            // IRIS_NO_ID if not set
    iris_sequence_id_t      on_deactivate;           // IRIS_NO_ID if not set
    char                   *name;                   // heap-allocated, null-terminated
    uint16_t                active_device_count;
    iris_device_id_t       *active_devices;          // heap-allocated array
    uint8_t                 physical_button_count;
    iris_physical_button_t *physical_buttons;        // heap-allocated array
    uint16_t                screen_button_count;
    iris_screen_button_t   *screen_buttons;          // heap-allocated array
} iris_state_t;

// ── Abstract I/O ─────────────────────────────────────────────────────────────

// Read `length` bytes from absolute byte offset `offset` into `output`.
typedef esp_err_t (*iris_read_fn_t)(void *context, uint32_t offset, uint8_t *output, uint16_t length);

// A reader bundles a read callback with the opaque context it needs to operate.
// Callers supply a concrete reader (buffer-backed, SPIFFS, SD, etc.); the config
// component calls through it without knowing the underlying source.
typedef struct {
    iris_read_fn_t  read;
    void           *context;
} iris_reader_t;

// ── Section index (fully loaded into memory at config load time) ──────────────

typedef struct {
    uint16_t  id;
    uint32_t  data_offset;   // absolute byte offset in the source
    uint16_t  data_length;
} iris_index_entry_t;        // 8 bytes — matches INDEX_ENTRY_SIZE in the binary format

typedef struct {
    iris_index_entry_t *entries;     // heap-allocated; sorted ascending by id
    uint16_t            entry_count;
} iris_section_index_t;

// ── Main config ───────────────────────────────────────────────────────────────

typedef struct {
    iris_state_id_t       root_state_id;
    iris_reader_t         reader;
    // Section indexes — always in memory; populated during load
    iris_section_index_t  state_section_index;
    iris_section_index_t  sequence_section_index;
    iris_section_index_t  function_section_index;
    iris_section_index_t  data_blocks_section_index;
    // Parsed pools — populated by the pool loading strategy (first impl: all at startup)
    iris_device_t        *device_pool;
    uint16_t              device_count;
    iris_function_t      *function_pool;
    uint16_t              function_count;
    iris_sequence_t      *sequence_pool;
    uint16_t              sequence_count;
    iris_state_t         *state_pool;
    uint16_t              state_count;
} iris_config_t;

// ── Loading ───────────────────────────────────────────────────────────────────

// Initialise config from an arbitrary reader. Populates all pools according to the
// current loading strategy (first impl: all records loaded immediately).
esp_err_t iris_config_load(iris_reader_t reader, iris_config_t *output);

// Convenience: initialise with a buffer-backed reader (useful for testing).
esp_err_t iris_config_load_buffer(const uint8_t *buffer, size_t buffer_length, iris_config_t *output);

// Free all heap memory owned by the config. Does not close the read source.
void iris_config_free(iris_config_t *config);

// ── Getters — pool management is internal; NULL means not found ───────────────

const iris_device_t   *iris_config_get_device  (iris_config_t *config, iris_device_id_t   id);
const iris_function_t *iris_config_get_function(iris_config_t *config, iris_function_id_t id);
const iris_sequence_t *iris_config_get_sequence(iris_config_t *config, iris_sequence_id_t id);
const iris_state_t    *iris_config_get_state   (iris_config_t *config, iris_state_id_t    id);

// ── Action execution ──────────────────────────────────────────────────────────

esp_err_t iris_run_action         (iris_config_t *config, const iris_action_t          *action);
esp_err_t iris_run_sequence       (iris_config_t *config, iris_sequence_id_t            sequence_id);
esp_err_t iris_run_physical_button(iris_config_t *config, const iris_physical_button_t *button);
esp_err_t iris_run_screen_button  (iris_config_t *config, const iris_screen_button_t   *button);
