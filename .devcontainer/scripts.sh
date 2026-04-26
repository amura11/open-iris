#!/usr/bin/env bash
# OpenIRis dev utility commands.
# Sourced automatically in all container shells by postCreate.sh.
#
# Usage:  <resource>:<action> [extra args forwarded to the underlying tool]
#
#   web:install      web:run      web:build    web:preview
#   web:check        web:format
#
#   firmware:build   firmware:clean   firmware:flash   firmware:monitor
#   firmware:flash-monitor           firmware:menuconfig
#   firmware:size    firmware:set-target [chip]
#
#   dev:install      dev:help

# Resolve the repo root from this file's own location, regardless of $PWD.
OPENIRIS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENIRIS_WEB_DIR="$OPENIRIS_ROOT/source/configurator"
OPENIRIS_FIRMWARE_DIR="$OPENIRIS_ROOT/source/firmware"

# ── Configurator (web) ───────────────────────────────────────────────────────

_web_install()       { (cd "$OPENIRIS_WEB_DIR" && npm install "$@"); }
_web_run()           { (cd "$OPENIRIS_WEB_DIR" && npm run dev "$@"); }
_web_build()         { (cd "$OPENIRIS_WEB_DIR" && npm run build "$@"); }
_web_preview()       { (cd "$OPENIRIS_WEB_DIR" && npm run preview "$@"); }
_web_check()         { (cd "$OPENIRIS_WEB_DIR" && npm run check "$@"); }
_web_format()        { (cd "$OPENIRIS_WEB_DIR" && npm run format "$@"); }

alias 'web:install'='_web_install'
alias 'web:run'='_web_run'
alias 'web:build'='_web_build'
alias 'web:preview'='_web_preview'
alias 'web:check'='_web_check'
alias 'web:format'='_web_format'

# ── Firmware ─────────────────────────────────────────────────────────────────

_firmware_build() {
    (cd "$OPENIRIS_FIRMWARE_DIR" && idf.py build "$@")
}

_firmware_clean() {
    (cd "$OPENIRIS_FIRMWARE_DIR" && idf.py fullclean "$@")
}

_firmware_flash() {
    (cd "$OPENIRIS_FIRMWARE_DIR" && idf.py flash "$@")
}

_firmware_monitor() {
    (cd "$OPENIRIS_FIRMWARE_DIR" && idf.py monitor "$@")
}

_firmware_flash_monitor() {
    (cd "$OPENIRIS_FIRMWARE_DIR" && idf.py flash monitor "$@")
}

_firmware_menuconfig() {
    (cd "$OPENIRIS_FIRMWARE_DIR" && idf.py menuconfig "$@")
}

_firmware_size() {
    (cd "$OPENIRIS_FIRMWARE_DIR" && idf.py size-components "$@")
}

_firmware_set_target() {
    local target="${1:-esp32}"
    (cd "$OPENIRIS_FIRMWARE_DIR" && idf.py set-target "$target")
}

alias 'firmware:build'='_firmware_build'
alias 'firmware:clean'='_firmware_clean'
alias 'firmware:flash'='_firmware_flash'
alias 'firmware:monitor'='_firmware_monitor'
alias 'firmware:flash-monitor'='_firmware_flash_monitor'
alias 'firmware:menuconfig'='_firmware_menuconfig'
alias 'firmware:size'='_firmware_size'
alias 'firmware:set-target'='_firmware_set_target'

# ── Project-wide ─────────────────────────────────────────────────────────────

_dev_install() {
    echo "→ Installing configurator dependencies..."
    (cd "$OPENIRIS_WEB_DIR" && npm install)
}

_dev_help() {
    cat <<'EOF'

OpenIRis dev commands
─────────────────────────────────────────────────────────────────────────────

  web:install          Install configurator npm dependencies
  web:run              Start Vite dev server  →  http://localhost:5173
  web:build            Build configurator for production
  web:preview          Serve the production build locally
  web:check            Run svelte-check (TypeScript + Svelte type checking)
  web:format           Run prettier on src/

  firmware:build       Build firmware  (idf.py build)
  firmware:clean       Delete all build artifacts  (idf.py fullclean)
  firmware:flash       Flash to device  (pass --port /dev/ttyUSBx if needed)
  firmware:monitor     Open serial monitor
  firmware:flash-monitor  Flash then immediately open serial monitor
  firmware:menuconfig  Open ESP-IDF Kconfig menu
  firmware:size        Show binary size breakdown by component
  firmware:set-target  Set target chip  (default: esp32)

  dev:install          Install all project dependencies
  dev:help             Show this help

Extra arguments are forwarded to the underlying tool, e.g.:
  firmware:flash --port /dev/ttyUSB1
  web:check -- --watch

EOF
}

alias 'dev:install'='_dev_install'
alias 'dev:help'='_dev_help'
