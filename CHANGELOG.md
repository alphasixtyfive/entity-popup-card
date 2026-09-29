# Changelog

## 1.0.2 — 29 September 2026

- Start each popup with a fresh Home Assistant dialog after swipe-down dismissal, so a previous drag cannot leave the next popup partway down the screen.
- Cancel an unfinished popup open when its card disconnects or its configuration changes.

## 1.0.1

- Fixed native popup controls that appeared to switch but did not call Home Assistant.
- Kept the dialog mounted through dashboard view updates while restoring the context native controls need.

## 1.0.0

- Rebuilt the card as a small wrapper for configurable Lovelace trigger and popup cards.
- Added `popup.source` for live entity lists supplied by an existing entity attribute.
- Used Home Assistant's adaptive dialog and native card rows and controls.
- Replaced the earlier section, control, and summary APIs with the smaller configuration documented in the README.
