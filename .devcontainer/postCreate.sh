#!/usr/bin/env bash
# Runs once after the devcontainer is created.
# Installs project dependencies and wires the dev utility scripts into the shell.

set -euo pipefail

WORKSPACE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS_FILE="$WORKSPACE_ROOT/.devcontainer/scripts.sh"
SOURCE_LINE=". \"$SCRIPTS_FILE\""

# Install configurator npm dependencies.
echo "→ Installing configurator npm dependencies..."
(cd "$WORKSPACE_ROOT/source/configurator" && npm install)

# Append the source line to .bashrc if it isn't already there.
if ! grep -qF "$SCRIPTS_FILE" ~/.bashrc 2>/dev/null; then
    echo "" >> ~/.bashrc
    echo "# OpenIRis dev utility commands" >> ~/.bashrc
    echo "$SOURCE_LINE" >> ~/.bashrc
    echo "→ Added dev utility scripts to ~/.bashrc"
fi

echo ""
echo "✓ OpenIRis dev environment ready."
echo "  Reload your shell or run:  source ~/.bashrc"
echo "  Then run:  dev:help"
echo ""
