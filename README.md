# OpenIRis

An open-source universal remote control built on ESP32. No accounts. No cloud. No subscriptions.

OpenIRis is a free alternative to the Logitech Harmony line — fully self-contained, configurable via a browser-based UI that can run directly on the device, and built on an open binary format that you own completely.

---

## Features

- **IR transmitter and receiver** — learn codes from existing remotes or use built-in device profiles
- **Activity-based control** — group devices into activities with entry and exit command sequences
- **Hierarchical menus** — navigate between control surfaces on the device display
- **Layered button mapping** — per-menu, per-activity, and global default bindings
- **Browser-based configuration** — no app to install; the config UI can be hosted on the device itself
- **Open binary format** — your configuration lives on your hardware, not in someone else's database
- **No internet required** — works entirely offline, forever

## Hardware

OpenIRis targets the **ESP32** microcontroller running **ESP-IDF**. Specific supported boards and wiring diagrams are covered in the [hardware documentation](docs/hardware.md).

## Getting started

Documentation is a work in progress. The following will be available before the first release:

- Hardware build guide
- Firmware build and flash instructions
- Configuration UI usage guide
- Config format reference

## Project status

Early development. The configuration data model and firmware architecture are being finalized. Not yet ready for general use.

Contributions, feedback, and hardware testing are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) when available.

## License

TBD — will be an OSI-approved open source license.
