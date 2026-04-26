FROM espressif/idf:v5.3

# udev — required by the ESP-IDF VS Code extension to enumerate serial ports via udevadm.
# git, curl — general dev environment conveniences.
RUN apt-get update && apt-get install -y --no-install-recommends \
    udev \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*
