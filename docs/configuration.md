# Configuration

`type: custom:entity-popup-card` needs an `entity` and at least one `popup.sections` entry. The card tap opens the popup. To choose the visible tile, use either `card:` with a Lovelace card configuration or top-level Mushroom template card fields.

For a badge above a dashboard view, use `type: custom:entity-popup-badge` with the same `entity` and `popup` settings. Its visible trigger is a Mushroom template badge; set `label`, `content`, `icon`, and `color` at the top level. Mushroom must be installed for the badge.

| Option                    | Purpose                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `entity`                  | Root entity used for status and member or value attributes.                                                                                            |
| `card`                    | Optional Lovelace card shown on the dashboard. Its tap opens this popup. Without it, the card uses a Mushroom template card and top-level tile fields. |
| `summary_tile`            | Optional built-in compact tile with `name` and optional `icon`; shows the first section's active count. Use instead of `card`.                      |
| `popup.title`             | Popup heading. Defaults to the root entity's friendly name.                                                                                            |
| `popup.status_text`       | Fixed summary under the title.                                                                                                                         |
| `popup.status_attribute`  | One root attribute to show as the summary.                                                                                                             |
| `popup.status_attributes` | Several root attributes to join into a summary.                                                                                                        |
| `popup.width`             | Optional desktop popup width in pixels, from 320 to 960. Defaults to 480; narrow screens still use a full-width bottom sheet.                          |
| `popup.sections`          | One or more lists, in display order.                                                                                                                   |
| `popup.actions_title`     | Heading above optional action buttons; defaults to `Actions`.                                                                                         |
| `popup.actions`           | Optional buttons with `entity`, `service` (`domain.service`), and optional `name` and `icon`.                                                          |
| `compact`                 | Let a Mushroom tile use its natural height.                                                                                                            |

## Section sources

| Source     | Fields                                                             | Use                                                                                                                        |
| ---------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `members`  | `attribute` (default `entity_id`), `recursive`, optional `domain`  | Read entity IDs from the root's attributes. `recursive: true` expands nested groups.                                       |
| `entities` | `entities`                                                         | List specific entity IDs. An entry can be a string or `{entity: ..., name: ..., icon: ...}`. The list keeps your order.    |
| `match`    | `prefix`, optional `suffix`                                        | Find entity IDs from current Home Assistant state by name pattern.                                                         |
| `values`   | `attribute`, optional `item_suffix`, `value_icons`, `value_colors` | Show simple values from an array attribute on the root entity.                                                             |
| `records`  | `attribute`, optional `kind_icons`, `severity_colors`              | Show objects from an array attribute with `name`, `value`, and optional `entity`, `kind`, `severity`, `icon`, and `color`. |

## Section display

| Option                                 | Purpose                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `title`                                | Heading above the section.                                                                                                           |
| `mode`                                 | `view` (default) or `controls`. Controls work with `members` and `entities` for lights, switches, fans, input booleans, and covers.  |
| `show`                                 | `all` (default) or `active`. `active` shows entities whose state matches `active_state`.                                             |
| `row_action`                           | `more-info` opens Home Assistant's native dialog when the row name is tapped.                                                        |
| `show_state`                           | Show a state line under each entity name. Home Assistant formats the state and unit.                                                 |
| `state_labels`                         | Optional replacements for specific state values.                                                                                     |
| `details`                              | Extra values in the row's detail line from an `attribute` or `field`; accepts `label`, `unit`, and `format: datetime`.               |
| `icon`, `active_icon`, `inactive_icon` | Row icon settings. An entity's own icon takes precedence.                                                                            |
| `active_state`, `inactive_state`       | State values used for counts and filtering in `view` sections; default to `on` and `off`. Control sections use each domain's states. |
| `singular`, `plural`, `active_label`   | Words used in a member section's automatic summary.                                                                                  |
| `empty_text`                           | Message shown when the section has no rows.                                                                                          |
| `bulk_label`                           | Optional label for a button that applies each active control's normal off action. Only for control sections.                        |

`mode: controls` calls `turn_on` or `turn_off` for lights, switches, fans, and input booleans. Covers use `open_cover` and `close_cover`, with a labeled button instead of a switch. Buttons are disabled while a service call is pending, when a cover is moving, or when an entity is unavailable. With `show: active`, an entity turned off or closed inside the popup remains visible until you close it, so the action is easy to reverse.

The optional `summary_tile` reads the first section's active count. For an `entities` control section, set `singular`, `plural`, and `active_label` to choose its wording. `bulk_label` uses the section's configured entities and each entity's normal control service, without a second entity list. `popup.actions` sends the named Home Assistant service with `{entity_id: ...}`. These buttons are disabled when their entity is missing, unknown, or unavailable; they do not infer whether a scene or script is currently active.

For `values` and `records`, each list item is read only. A record with an `entity` can use `row_action: more-info` to open its native Home Assistant details. Use `details: [{field: value}, {field: last_changed, label: Updated, format: datetime}]` to show its reported reason and last state change. For custom summaries, use `status_text` or root attributes; otherwise only member sections display an automatic count.
