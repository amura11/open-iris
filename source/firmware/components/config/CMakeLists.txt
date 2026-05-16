idf_component_register(
    SRCS "config.c" "config_util.c" "config_index.c" "config_pool.c" "action.c"
    INCLUDE_DIRS "include"
    REQUIRES esp_common fatfs freertos
)
