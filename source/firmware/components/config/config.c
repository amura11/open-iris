#include "config.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "esp_log.h"

static const char *TAG = "config";

// Binary format magic + version
#define IRIS_MAGIC    "IRIS"
#define IRIS_VERSION  0x01

// Manifest type tags
#define TAG_CONTEXTS    0x01
#define TAG_ITEMS       0x02
#define TAG_STRING_BLOB 0x03

// TODO: Implement two-pass binary loader.
// See INITIAL_BUILD_PLAN.md for the full binary format specification.
esp_err_t config_load(const char *path, config_t *out_config)
{
    memset(out_config, 0, sizeof(*out_config));
    ESP_LOGE(TAG, "config_load: not yet implemented");
    return ESP_ERR_NOT_SUPPORTED;
}

void config_free(config_t *config)
{
    if (!config) return;
    free(config->raw_buffer);
    free(config->contexts);
    memset(config, 0, sizeof(*config));
}
