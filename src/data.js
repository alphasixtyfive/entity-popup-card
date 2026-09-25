import { controlFor, isActive as controlIsActive, isKnown as controlIsKnown } from "./controls.js";

const ENTITY = /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/;
const PATH = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)*$/;
const SOURCES = new Set(["members", "entities", "match", "values", "records"]);
const MODES = new Set(["view", "controls"]);
// Attribute paths come from YAML, so read only ordinary properties on each object.
const PROTOTYPE_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const readable = (value) =>
  String(value ?? "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const sortName = (a, b) => nameCollator.compare(a.name, b.name);

function atPath(value, path) {
  if (!PATH.test(path || "")) return undefined;
  for (const key of path.split(".")) {
    if (
      PROTOTYPE_KEYS.has(key) ||
      value == null ||
      !Object.prototype.hasOwnProperty.call(Object(value), key)
    )
      return undefined;
    value = value[key];
  }
  return value;
}

function ids(value) {
  if (typeof value === "string" && ENTITY.test(value)) return [value];
  if (Array.isArray(value)) return value.filter((id) => typeof id === "string" && ENTITY.test(id));
  return null;
}

function entityItem(states, id, section, name) {
  const record = states?.[id];
  return {
    key: id,
    entity: id,
    name: name || record?.attributes?.friendly_name || id,
    state: record?.state ?? "unavailable",
    icon: record?.attributes?.icon || section.icon,
    attributes: record?.attributes || {},
    last_changed: record?.last_changed,
  };
}

function collectSection(states, rootEntity, section) {
  const root = states?.[rootEntity];
  const result = {
    items: [],
    allItems: [],
    memberIds: new Set(),
    activeCount: 0,
    unavailable: [],
    membershipKnown: true,
    sourceAvailable:
      !["members", "values", "records"].includes(section.source) ||
      (!!root && !["unknown", "unavailable"].includes(root.state)),
  };
  const seen = new Set();
  const active = section.active_state || "on";
  const inactive = section.inactive_state || "off";
  const add = (item) => {
    if (seen.has(item.key)) return;
    seen.add(item.key);
    result.allItems.push(item);
    if (item.entity) result.memberIds.add(item.entity);
    const control = section.mode === "controls" ? controlFor(item.entity) : null;
    const itemActive = control ? controlIsActive(control, item.state) : item.state === active;
    const stateKnown = control
      ? controlIsKnown(control, item.state)
      : item.state === active || item.state === inactive;
    if (itemActive) result.activeCount++;
    if (!stateKnown && section.source === "members") result.unavailable.push(item);
    if (section.show !== "active" || itemActive) result.items.push(item);
  };

  if (section.source === "members") {
    const members = ids(atPath(root?.attributes, section.attribute || "entity_id"));
    result.membershipKnown = members !== null;
    const visited = new Set([rootEntity]);
    const visit = (id) => {
      if (visited.has(id)) return;
      visited.add(id);
      if (section.domain && !id.startsWith(`${section.domain}.`) && !section.recursive) return;
      const record = states?.[id];
      const children = section.recursive ? ids(record?.attributes?.entity_id) : null;
      if (children !== null) {
        children.forEach(visit);
        return;
      }
      if (section.domain && !id.startsWith(`${section.domain}.`)) return;
      if (section.mode === "controls" && !controlFor(id)) return;
      const item = entityItem(states, id, section);
      add(item);
    };
    members?.forEach(visit);
  } else if (section.source === "entities") {
    for (const entry of section.entities) {
      const id = typeof entry === "string" ? entry : entry.entity;
      add(entityItem(states, id, section, typeof entry === "object" ? entry.name : undefined));
    }
  } else if (section.source === "match") {
    for (const id of Object.keys(states || {})) {
      if (!id.startsWith(section.prefix) || !id.endsWith(section.suffix || "")) continue;
      const stem = id.slice(
        section.prefix.length,
        (section.suffix || "").length ? -section.suffix.length : undefined,
      );
      add(entityItem(states, id, section, readable(stem)));
    }
  } else if (section.source === "values") {
    const values = result.sourceAvailable ? atPath(root?.attributes, section.attribute) : undefined;
    result.membershipKnown = Array.isArray(values);
    for (const [index, value] of (Array.isArray(values) ? values : []).entries()) {
      if (!["string", "number", "boolean"].includes(typeof value)) continue;
      add({
        key: `value:${index}`,
        name: `${readable(value)}${section.item_suffix || ""}`,
        state: "",
        attributes: {},
        icon: section.value_icons?.[value] || section.icon,
        color: section.value_colors?.[value],
      });
    }
  } else if (section.source === "records") {
    const records = result.sourceAvailable
      ? atPath(root?.attributes, section.attribute)
      : undefined;
    result.membershipKnown = Array.isArray(records);
    for (const [index, value] of (Array.isArray(records) ? records : []).entries()) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const entity =
        typeof value.entity === "string" && ENTITY.test(value.entity) ? value.entity : undefined;
      const record = entity ? states?.[entity] : undefined;
      const name =
        typeof value.name === "string" && value.name.trim()
          ? value.name
          : record?.attributes?.friendly_name || entity || `Item ${index + 1}`;
      add({
        key: `record:${index}`,
        entity,
        name,
        state: record?.state ?? "unavailable",
        icon:
          value.icon ||
          section.kind_icons?.[value.kind] ||
          record?.attributes?.icon ||
          section.icon,
        color: value.color || section.severity_colors?.[value.severity],
        attributes: record?.attributes || {},
        last_changed: record?.last_changed,
        value: value.value,
        kind: value.kind,
        severity: value.severity,
      });
    }
  }
  if (["members", "match"].includes(section.source)) {
    result.items.sort(sortName);
    result.allItems.sort(sortName);
    result.unavailable.sort(sortName);
  }
  return result;
}

export {
  ENTITY,
  PATH,
  SOURCES,
  MODES,
  readable,
  sortName,
  atPath,
  ids,
  entityItem,
  collectSection,
};
