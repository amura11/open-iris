#pragma once

#include <stdint.h>
#include <stdbool.h>

// ── Sentinel ──────────────────────────────────────────────────────────────────

#define IRIS_NO_ID  UINT16_MAX   // 0xFFFF — "not set" for any uint16 ID

// ── System functions — device ID 0xFFFF means system; function ID selects which ──

#define IRIS_SYSTEM_DEVICE_ID         UINT16_MAX
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
    IRIS_ASSIGN_UNASSIGNED = 0x00,  // only valid for screen buttons
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
    iris_device_id_t device_id;
    iris_function_id_t function_id;
    uint16_t data;  // inline value or data_block_id; IRIS_NO_ID if unused
} iris_action_t;

// ── Device ────────────────────────────────────────────────────────────────────

typedef struct {
    iris_device_id_t id;
    iris_device_type_t type;
    iris_power_mode_t power_mode;
    iris_function_id_t power_on_function_id;   // IRIS_NO_ID if not set
    iris_function_id_t power_off_function_id;  // IRIS_NO_ID if not set
    char *name;                                // heap-allocated, null-terminated
} iris_device_t;

// ── Parsed function data (one variant per device type) ───────────────────────

typedef struct {
    uint8_t protocol;  // IRIS_IR_PROTOCOL_* byte
    uint64_t code;     // parsed little-endian uint64
} iris_ir_data_t;

typedef struct {
    uint8_t method;  // 0x01=GET  0x02=POST  0x03=PUT  0x04=DELETE
    char *url;       // heap-allocated, null-terminated
    char *body;      // heap-allocated, null-terminated; NULL if empty
} iris_rest_data_t;

// ── Parsed function ───────────────────────────────────────────────────────────

typedef struct {
    iris_function_id_t id;
    iris_device_id_t device_id;
    iris_device_type_t device_type;  // duplicated from device for dispatch without lookup
    char *name;                      // heap-allocated, null-terminated
    union {
        iris_ir_data_t ir;
        iris_rest_data_t rest;
    } data;
} iris_function_t;

// ── Parsed sequence ───────────────────────────────────────────────────────────

typedef struct {
    iris_sequence_id_t id;
    uint8_t action_count;
    iris_action_t *actions;  // heap-allocated array
} iris_sequence_t;

// ── Button configs ────────────────────────────────────────────────────────────

typedef struct {
    uint8_t button_code;
    iris_assignment_type_t assignment_type;
    union {
        iris_sequence_id_t sequence_id;
        iris_action_t action;
    };
} iris_physical_button_t;

typedef struct {
    char *label;                        // heap-allocated, null-terminated
    uint16_t icon_id;                   // IRIS_NO_ID if not set
    iris_assignment_type_t assignment_type;  // IRIS_ASSIGN_UNASSIGNED if not configured
    union {
        iris_sequence_id_t sequence_id;
        iris_action_t action;
    };
} iris_screen_button_t;

// ── State ─────────────────────────────────────────────────────────────────────

typedef struct {
    iris_state_id_t id;
    iris_state_type_t state_type;
    bool button_fallback;
    iris_sequence_id_t on_activate;   // IRIS_NO_ID if not set
    iris_sequence_id_t on_deactivate; // IRIS_NO_ID if not set
    char *name;                       // heap-allocated, null-terminated
    uint16_t active_device_count;
    iris_device_id_t *active_devices; // heap-allocated array
    uint8_t physical_button_count;
    iris_physical_button_t *physical_buttons; // heap-allocated array
    uint16_t screen_button_count;
    iris_screen_button_t *screen_buttons;     // heap-allocated array
} iris_state_t;
