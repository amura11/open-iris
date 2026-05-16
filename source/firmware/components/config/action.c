#include "config.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "iris_action";

// ── System function stubs ─────────────────────────────────────────────────────

static esp_err_t run_system_function(iris_config_t *config, iris_function_id_t function_id, uint16_t data)
{
    (void)config;

    switch (function_id) {
        case IRIS_SYS_FN_NAVIGATE:
            ESP_LOGI(TAG, "navigate → state %u", data);
            return ESP_OK;

        case IRIS_SYS_FN_PAUSE:
            ESP_LOGI(TAG, "pause %u ms", data);
            vTaskDelay(pdMS_TO_TICKS(data));
            return ESP_OK;

        case IRIS_SYS_FN_POWER_OFF_ACTIVE:
            ESP_LOGI(TAG, "power off active devices");
            return ESP_OK;

        default:
            ESP_LOGW(TAG, "unknown system function 0x%04x", function_id);
            return ESP_ERR_NOT_SUPPORTED;
    }
}

// ── Device-type stubs ─────────────────────────────────────────────────────────

static esp_err_t run_ir_function(const iris_ir_data_t *ir_data, uint16_t data)
{
    (void)data;
    ESP_LOGI(TAG, "IR send protocol=0x%02x code=0x%016llx", ir_data->protocol, (unsigned long long)ir_data->code);
    // Actual IR transmission is handled by a separate hardware component.
    return ESP_OK;
}

static esp_err_t run_rest_function(const iris_rest_data_t *rest_data, uint16_t data)
{
    (void)data;
    ESP_LOGI(TAG, "REST %u %s", rest_data->method, rest_data->url ? rest_data->url : "(no url)");
    return ESP_ERR_NOT_SUPPORTED;  // HTTP client not yet implemented
}

// ── Public: iris_run_action ───────────────────────────────────────────────────

esp_err_t iris_run_action(iris_config_t *config, const iris_action_t *action)
{
    if (action->device_id == IRIS_SYSTEM_DEVICE_ID) {
        return run_system_function(config, action->function_id, action->data);
    }

    const iris_function_t *function_record = iris_config_get_function(config, action->function_id);

    if (!function_record) {
        ESP_LOGE(TAG, "function %u not found", action->function_id);
        return ESP_ERR_NOT_FOUND;
    }

    switch (function_record->device_type) {
        case IRIS_DEVICE_TYPE_IR:
            return run_ir_function(&function_record->data.ir, action->data);

        case IRIS_DEVICE_TYPE_REST:
            return run_rest_function(&function_record->data.rest, action->data);

        default:
            ESP_LOGW(TAG, "unsupported device type %d", function_record->device_type);
            return ESP_ERR_NOT_SUPPORTED;
    }
}

// ── Public: iris_run_sequence ─────────────────────────────────────────────────

esp_err_t iris_run_sequence(iris_config_t *config, iris_sequence_id_t sequence_id)
{
    const iris_sequence_t *sequence_record = iris_config_get_sequence(config, sequence_id);

    if (!sequence_record) {
        ESP_LOGE(TAG, "sequence %u not found", sequence_id);
        return ESP_ERR_NOT_FOUND;
    }

    for (uint8_t action_index = 0; action_index < sequence_record->action_count; action_index++) {
        esp_err_t error = iris_run_action(config, &sequence_record->actions[action_index]);

        if (error != ESP_OK) {
            ESP_LOGW(TAG, "action %u in sequence %u failed: %d", action_index, sequence_id, error);
        }
    }

    return ESP_OK;
}

// ── Public: iris_run_physical_button ─────────────────────────────────────────

esp_err_t iris_run_physical_button(iris_config_t *config, const iris_physical_button_t *button)
{
    if (button->assignment_type == IRIS_ASSIGN_SEQUENCE) {
        return iris_run_sequence(config, button->sequence_id);
    }

    return iris_run_action(config, &button->action);
}

// ── Public: iris_run_screen_button ───────────────────────────────────────────

esp_err_t iris_run_screen_button(iris_config_t *config, const iris_screen_button_t *button)
{
    if (button->assignment_type == IRIS_ASSIGN_UNASSIGNED) {
        return ESP_OK;
    }

    if (button->assignment_type == IRIS_ASSIGN_SEQUENCE) {
        return iris_run_sequence(config, button->sequence_id);
    }

    return iris_run_action(config, &button->action);
}
