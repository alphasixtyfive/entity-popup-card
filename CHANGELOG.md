# Changelog

## 1.4.0

- Control rows show their state and open Home Assistant's more-info by default. Existing `show_state` and `row_action` settings still override this.
- Summary tiles infer words such as `lights on` or `covers open` from a single control domain, and use the tile name as the popup title when no other title is supplied.
- Generic service buttons leave unrelated light operations tracked; outdated screenshot previews were removed from the current docs.

## 1.3.3

- Scene buttons stay available during unrelated light changes instead of briefly dimming. Starting a scene clears pending light feedback.
- Dividers return between popup rows, centered in generous space so they do not crowd the hover highlight. Two-line rows keep a 56px minimum height.
- Service and bulk buttons use Home Assistant's neutral hover color. A new example shows mixed controls, readings, optional text, and service buttons in one popup.

## 1.3.2

- Popup rows use Home Assistant's entity-row spacing instead of dividers, leaving clear space around the hover highlight.

## 1.3.1

- Summary tiles use compact text sizing and stretch within their dashboard cell, aligning with adjacent tiles.
- Popup control rows now highlight as one row, with inset content and no redundant chevron; row details and the right-hand control keep their existing actions.

## 1.3.0

- Summary tiles built from explicit or matching entities no longer need an unrelated root entity.
- Service buttons accept optional data for actions beyond simple scene activation.
- Bulk controls group matching targets into one service call and settle cleanly when state updates arrive quickly or after the popup closes.

## 1.2.0

- Optional summary tiles show a popup section's live active count without a dashboard template.
- Control sections can offer a single bulk off button without repeating their entity list.
- Optional service buttons let a popup run configured entity actions, including scenes, without room-specific code.
- Explicit entity icons work in fixed lists.
- Record sections and compact badges share the same popup.

## 1.1.0

- Wider clickable highlight for read-only rows, with the original text and control spacing preserved.
- Optional desktop popup width from 320 to 960 pixels.
- Faster sorting for large member and matching-entity lists.

## 1.0.0

- Initial public release of the entity popup card.
- Built-in Tile and Mushroom template card support.
- Live member, entity, pattern, and value lists.
- Quick on/off controls with links to native more-info.
- Mobile bottom sheet layout and Home Assistant theme tokens.
- Readable source modules in `src/`, with a reproducible HACS build.
- Cover controls with Open and Close actions.
