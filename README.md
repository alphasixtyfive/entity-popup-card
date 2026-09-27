# Entity Popup Card

A small Home Assistant dashboard wrapper that opens a Lovelace card in Home Assistant's adaptive dialog. Choose the tile with `card` and the dialog content with `popup.card`. Entity controls and state formatting come from Home Assistant's cards.

## Install

Add `entity-popup-card.js` as a dashboard resource (`JavaScript module`), either with HACS or by copying it to `/config/www` and using `/local/entity-popup-card.js`. A fresh version query such as `?v=1.0.0` helps refresh browser caches after an update.

## Example

```yaml
type: custom:entity-popup-card
entity: light.upstrairs
card:
  type: custom:mushroom-template-card
  primary: Upstairs lights
  icon: mdi:home-floor-1
  secondary: "{{ states(entity) | capitalize }}"
popup:
  title: Upstairs lights
  source:
    recursive: true
    domain: light
    state: "on"
  card:
    type: entities
    show_header_toggle: false
  empty: All lights are off.
```

`card` accepts a Lovelace card that supports `tap_action`. The wrapper assigns its tap action to open the dialog. Other actions inside the card, such as Mushroom's `icon_tap_action`, still work. Add a native Entities `footer` to `popup.card` if you want an **All off** button:

```yaml
footer:
  type: buttons
  entities:
    - entity: light.upstrairs
      name: All off
      show_icon: false
      show_name: true
      tap_action:
        action: perform-action
        perform_action: light.turn_off
        target:
          entity_id: light.upstrairs
```

`popup.card` accepts a Lovelace card configuration. For a fixed list, configure it directly:

```yaml
popup:
  title: Air & pollen
  card:
    type: entities
    show_header_toggle: false
    entities:
      - sensor.home_uaqi_category
      - type: divider
      - sensor.kleenex_pollen_trees_level
      - sensor.kleenex_pollen_grass_level
      - sensor.kleenex_pollen_weeds_level
```

For a live list, add `popup.source` and omit `popup.card.entities`. The source reads an array attribute from `entity`. Set `source.entity` to read another entity, `source.attribute` for an attribute other than `entity_id`, `source.recursive: true` to expand nested groups, and `source.domain` or `source.state` to filter rows. `source` works with an `entities` popup card. Active rows remain visible until the dialog closes so a light switched off there can be switched on again.

`popup.title`, `popup.empty`, and `popup.width` (320–960 pixels) are optional. Selecting an entity row opens Home Assistant's more-info dialog. A badge trigger is also available as `custom:entity-popup-badge` with a nested `badge` Mushroom template badge configuration and the same `popup` options.

## Development

Run `npm ci`, `npm run build`, and `npm test`. The root `entity-popup-card.js` is generated from `src/` and committed for HACS.

Licensed under [MIT](LICENSE).
