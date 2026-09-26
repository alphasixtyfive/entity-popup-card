# Changelog

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
