# Firmware — Agent Guidance

ESP-IDF C firmware for the OpenIRis ESP32 remote control. See [../../agents.md](../../agents.md) for project-wide standards that also apply here.

## Tech stack

- **Language:** C (C17)
- **Framework:** ESP-IDF 5.x
- **UI library:** LVGL (for the on-device display)
- **Build system:** CMake via `idf.py`

## Project structure

```
main/              Application entry point
components/
  config/          Binary config loader — reads the .iris config format
  display/         LVGL + ILI9341 SPI display driver
  ui/              On-device UI built with LVGL
```

## Naming conventions

Follow standard C conventions with the ESP-IDF style:

- **Types:** `snake_case` with a `_t` suffix — `config_t`, `context_t`, `item_t`
- **Functions:** `component_verb_noun` — `config_load`, `display_init`, `ui_render_menu`
- **Constants / macros:** `SCREAMING_SNAKE_CASE` — `IRIS_MAGIC`, `TAG_CONTEXTS`
- **Static file-scope variables:** `snake_case`, typically prefixed by their component — `static const char *TAG = "config";`
- **Parameters and locals:** `snake_case`, never abbreviated — `output_config` not `out_cfg`, `byte_count` not `n`

## Code style

- **Braces:** Always use braces for control flow blocks, even single-statement bodies.
- **Line length:** No limit. Do not wrap at 80 or 120 characters.
- **Brace placement:** Allman style — opening braces go on their own line for functions and control structures.
- **Indentation:** 4 spaces, no tabs.
- **Headers:** Use `#pragma once` instead of include guards.
- **Pointer spacing:** `type *name` (star binds to the name, not the type).

## ESP-IDF patterns

- Use `ESP_LOGI` / `ESP_LOGE` / `ESP_LOGW` for logging with a file-scope `TAG`.
- Return `esp_err_t` from functions that can fail; check with `ESP_ERROR_CHECK` or explicit error handling at call sites.
- Prefer static allocation or arena allocation over repeated `malloc`/`free` in hot paths.
- String pointers inside `config_t` point into `string_blob` — do not free them independently.
- Managed components live in `idf_component.yml`; add new ESP-IDF dependencies there, not as git submodules.

## Comments

Only write a comment when the **why** is non-obvious — a hardware constraint, a subtle invariant, a workaround for a specific ESP-IDF quirk, or behavior that would surprise a reader. Do not describe what the code does in plain English if well-named identifiers already say it.
