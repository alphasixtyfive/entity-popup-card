import { ENTITY, PATH, SOURCES, MODES } from "./data.js";
import { CONTROL_TYPES, controlFor } from "./controls.js";

const isEntity = (value) => typeof value === "string" && ENTITY.test(value);
const isPath = (value) => typeof value === "string" && PATH.test(value);
const entryEntity = (entry) => (typeof entry === "string" ? entry : entry?.entity);

function validateSection(section) {
  if (!section || !SOURCES.has(section.source)) {
    throw new Error("Choose a popup section source: members, entities, match, or values.");
  }
  if (!MODES.has(section.mode || "view")) {
    throw new Error("Section mode must be view or controls.");
  }
  if (section.show && !["all", "active"].includes(section.show)) {
    throw new Error("Section show must be all or active.");
  }
  if (section.row_action && !["more-info", "none"].includes(section.row_action)) {
    throw new Error("Row action must be more-info or none.");
  }

  if (section.source === "members" && !isPath(section.attribute || "entity_id")) {
    throw new Error("Invalid member attribute.");
  }
  if (section.source === "values" && !isPath(section.attribute)) {
    throw new Error("A values section needs an attribute.");
  }
  if (
    section.source === "entities" &&
    (!Array.isArray(section.entities) ||
      section.entities.some((entry) => !isEntity(entryEntity(entry))))
  ) {
    throw new Error("An entities section needs valid entity IDs.");
  }
  if (
    section.source === "match" &&
    (typeof section.prefix !== "string" ||
      !section.prefix.includes(".") ||
      typeof (section.suffix || "") !== "string")
  ) {
    throw new Error("A match section needs a domain prefix and optional suffix.");
  }

  if (section.mode === "controls") {
    if (!["members", "entities"].includes(section.source)) {
      throw new Error("Controls need a members or entities section.");
    }
    if (section.domain && !CONTROL_TYPES.has(section.domain)) {
      throw new Error("This domain has no quick control. Use a view section for it.");
    }
    if (section.active_state || section.inactive_state) {
      throw new Error("Control states are chosen by the entity domain.");
    }
    if (
      section.source === "entities" &&
      section.entities.some((entry) => {
        const entity = entryEntity(entry);
        return !controlFor(entity) || (section.domain && !entity.startsWith(`${section.domain}.`));
      })
    ) {
      throw new Error("Controls need supported entities in the selected domain.");
    }
  }

  if (
    section.details &&
    (!Array.isArray(section.details) ||
      section.details.some((detail) => !detail || !isPath(detail.attribute || detail.field)))
  ) {
    throw new Error("Invalid row details.");
  }
}

export function validateConfig(config) {
  if (
    !isEntity(config?.entity) ||
    !Array.isArray(config.popup?.sections) ||
    !config.popup.sections.length
  ) {
    throw new Error("Entity Popup Card needs an entity and at least one popup section.");
  }
  if (
    config.card &&
    (typeof config.card !== "object" ||
      Array.isArray(config.card) ||
      typeof config.card.type !== "string" ||
      !config.card.type)
  ) {
    throw new Error("The card option needs a Lovelace card type.");
  }
  if (config.popup.status_attribute && !isPath(config.popup.status_attribute)) {
    throw new Error("Invalid popup status attribute.");
  }
  if (
    config.popup.status_attributes &&
    (!Array.isArray(config.popup.status_attributes) ||
      config.popup.status_attributes.some((path) => !isPath(path)))
  ) {
    throw new Error("Invalid popup status attributes.");
  }
  config.popup.sections.forEach(validateSection);
}
