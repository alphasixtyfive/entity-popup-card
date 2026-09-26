/* Generated from src/. Edit the source files, then run npm run build. */
(() => {
  // src/controls.js
  var ON_OFF = Object.freeze({
    activeStates: ["on"],
    inactiveStates: ["off"],
    activeState: "on",
    inactiveState: "off",
    turnOn: "turn_on",
    turnOff: "turn_off",
    onLabel: "Turn on",
    offLabel: "Turn off",
    presentation: "switch",
    activeLabel: "on"
  });
  var COVER = Object.freeze({
    activeStates: ["open", "opening"],
    inactiveStates: ["closed", "closing"],
    activeState: "open",
    inactiveState: "closed",
    turnOn: "open_cover",
    turnOff: "close_cover",
    onLabel: "Open",
    offLabel: "Close",
    presentation: "button",
    activeLabel: "open"
  });
  var CONTROL_TYPES = /* @__PURE__ */ new Map([
    ["light", ON_OFF],
    ["switch", ON_OFF],
    ["fan", ON_OFF],
    ["input_boolean", ON_OFF],
    ["cover", COVER]
  ]);
  function controlFor(entityId) {
    return CONTROL_TYPES.get(entityId?.split(".")[0]);
  }
  function isActive(control, state) {
    return control?.activeStates.includes(state) ?? false;
  }
  function isKnown(control, state) {
    return control?.activeStates.includes(state) || control?.inactiveStates.includes(state) || false;
  }
  function actionFor(control, state) {
    if (state === control.activeState) {
      return {
        service: control.turnOff,
        label: control.offLabel,
        target: control.inactiveState,
        confirmedStates: control.inactiveStates
      };
    }
    if (state === control.inactiveState) {
      return {
        service: control.turnOn,
        label: control.onLabel,
        target: control.activeState,
        confirmedStates: control.activeStates
      };
    }
    return null;
  }

  // src/data.js
  var ENTITY = /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/;
  var PATH = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)*$/;
  var SOURCES = /* @__PURE__ */ new Set(["members", "entities", "match", "values", "records"]);
  var MODES = /* @__PURE__ */ new Set(["view", "controls"]);
  var PROTOTYPE_KEYS = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
  var readable = (value) => String(value ?? "").replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  var nameCollator = new Intl.Collator(void 0, { numeric: true, sensitivity: "base" });
  var sortName = (a, b) => nameCollator.compare(a.name, b.name);
  function atPath(value, path) {
    if (!PATH.test(path || "")) return void 0;
    for (const key of path.split(".")) {
      if (PROTOTYPE_KEYS.has(key) || value == null || !Object.prototype.hasOwnProperty.call(Object(value), key))
        return void 0;
      value = value[key];
    }
    return value;
  }
  function ids(value) {
    if (typeof value === "string" && ENTITY.test(value)) return [value];
    if (Array.isArray(value)) return value.filter((id) => typeof id === "string" && ENTITY.test(id));
    return null;
  }
  function entityItem(states, id, section, name, icon) {
    const record = states?.[id];
    return {
      key: id,
      entity: id,
      name: name || record?.attributes?.friendly_name || id,
      state: record?.state ?? "unavailable",
      icon: icon || record?.attributes?.icon || section.icon,
      attributes: record?.attributes || {},
      last_changed: record?.last_changed
    };
  }
  function collectSection(states, rootEntity, section) {
    const root = states?.[rootEntity];
    const result = {
      items: [],
      allItems: [],
      memberIds: /* @__PURE__ */ new Set(),
      activeCount: 0,
      unavailable: [],
      membershipKnown: true,
      sourceAvailable: !["members", "values", "records"].includes(section.source) || !!root && !["unknown", "unavailable"].includes(root.state)
    };
    const seen = /* @__PURE__ */ new Set();
    const active = section.active_state || "on";
    const inactive = section.inactive_state || "off";
    const add = (item) => {
      if (seen.has(item.key)) return;
      seen.add(item.key);
      result.allItems.push(item);
      if (item.entity) result.memberIds.add(item.entity);
      const control = section.mode === "controls" ? controlFor(item.entity) : null;
      const itemActive = control ? isActive(control, item.state) : item.state === active;
      const stateKnown = control ? isKnown(control, item.state) : item.state === active || item.state === inactive;
      if (itemActive) result.activeCount++;
      if (!stateKnown && section.source === "members") result.unavailable.push(item);
      if (section.show !== "active" || itemActive) result.items.push(item);
    };
    if (section.source === "members") {
      const members = ids(atPath(root?.attributes, section.attribute || "entity_id"));
      result.membershipKnown = members !== null;
      const visited = /* @__PURE__ */ new Set([rootEntity]);
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
        add(
          entityItem(
            states,
            id,
            section,
            typeof entry === "object" ? entry.name : void 0,
            typeof entry === "object" ? entry.icon : void 0
          )
        );
      }
    } else if (section.source === "match") {
      for (const id of Object.keys(states || {})) {
        if (!id.startsWith(section.prefix) || !id.endsWith(section.suffix || "")) continue;
        const stem = id.slice(
          section.prefix.length,
          (section.suffix || "").length ? -section.suffix.length : void 0
        );
        add(entityItem(states, id, section, readable(stem)));
      }
    } else if (section.source === "values") {
      const values = result.sourceAvailable ? atPath(root?.attributes, section.attribute) : void 0;
      result.membershipKnown = Array.isArray(values);
      for (const [index, value] of (Array.isArray(values) ? values : []).entries()) {
        if (!["string", "number", "boolean"].includes(typeof value)) continue;
        add({
          key: `value:${index}`,
          name: `${readable(value)}${section.item_suffix || ""}`,
          state: "",
          attributes: {},
          icon: section.value_icons?.[value] || section.icon,
          color: section.value_colors?.[value]
        });
      }
    } else if (section.source === "records") {
      const records = result.sourceAvailable ? atPath(root?.attributes, section.attribute) : void 0;
      result.membershipKnown = Array.isArray(records);
      for (const [index, value] of (Array.isArray(records) ? records : []).entries()) {
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        const entity = typeof value.entity === "string" && ENTITY.test(value.entity) ? value.entity : void 0;
        const record = entity ? states?.[entity] : void 0;
        const name = typeof value.name === "string" && value.name.trim() ? value.name : record?.attributes?.friendly_name || entity || `Item ${index + 1}`;
        add({
          key: `record:${index}`,
          entity,
          name,
          state: record?.state ?? "unavailable",
          icon: value.icon || section.kind_icons?.[value.kind] || record?.attributes?.icon || section.icon,
          color: value.color || section.severity_colors?.[value.severity],
          attributes: record?.attributes || {},
          last_changed: record?.last_changed,
          value: value.value,
          kind: value.kind,
          severity: value.severity
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

  // src/config.js
  var isEntity = (value) => typeof value === "string" && ENTITY.test(value);
  var isPath = (value) => typeof value === "string" && PATH.test(value);
  var entryEntity = (entry) => typeof entry === "string" ? entry : entry?.entity;
  var isService = (value) => typeof value === "string" && /^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/.test(value);
  function validateSection(section) {
    if (!section || !SOURCES.has(section.source)) {
      throw new Error("Choose a popup section source: members, entities, match, values, or records.");
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
    if (section.bulk_label !== void 0 && (section.mode !== "controls" || typeof section.bulk_label !== "string" || !section.bulk_label.trim())) {
      throw new Error("A bulk label needs a control section and non-empty text.");
    }
    if (section.source === "members" && !isPath(section.attribute || "entity_id")) {
      throw new Error("Invalid member attribute.");
    }
    if (["values", "records"].includes(section.source) && !isPath(section.attribute)) {
      throw new Error(`A ${section.source} section needs an attribute.`);
    }
    if (section.source === "entities" && (!Array.isArray(section.entities) || section.entities.some((entry) => !isEntity(entryEntity(entry))))) {
      throw new Error("An entities section needs valid entity IDs.");
    }
    if (section.source === "match" && (typeof section.prefix !== "string" || !section.prefix.includes(".") || typeof (section.suffix || "") !== "string")) {
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
      if (section.source === "entities" && section.entities.some((entry) => {
        const entity = entryEntity(entry);
        return !controlFor(entity) || section.domain && !entity.startsWith(`${section.domain}.`);
      })) {
        throw new Error("Controls need supported entities in the selected domain.");
      }
    }
    if (section.details && (!Array.isArray(section.details) || section.details.some((detail) => !detail || !isPath(detail.attribute || detail.field)))) {
      throw new Error("Invalid row details.");
    }
  }
  function validateConfig(config) {
    const sections = config?.popup?.sections;
    const rootOptional = !!config?.summary_tile && Array.isArray(sections) && sections.every((section) => ["entities", "match"].includes(section?.source)) && !config.popup.status_attribute && !config.popup.status_attributes;
    if (!Array.isArray(sections) || !sections.length || (config.entity !== void 0 ? !isEntity(config.entity) : !rootOptional)) {
      throw new Error(
        "Entity Popup Card needs a popup section and an entity unless a summary tile uses an explicit list or match."
      );
    }
    if (config.card && (typeof config.card !== "object" || Array.isArray(config.card) || typeof config.card.type !== "string" || !config.card.type)) {
      throw new Error("The card option needs a Lovelace card type.");
    }
    if (config.summary_tile && (config.card || typeof config.summary_tile !== "object" || Array.isArray(config.summary_tile) || typeof config.summary_tile.name !== "string" || !config.summary_tile.name.trim() || config.summary_tile.icon !== void 0 && typeof config.summary_tile.icon !== "string")) {
      throw new Error("A summary tile needs a name and optional icon, without a card option.");
    }
    if (config.popup.status_attribute && !isPath(config.popup.status_attribute)) {
      throw new Error("Invalid popup status attribute.");
    }
    if (config.popup.status_attributes && (!Array.isArray(config.popup.status_attributes) || config.popup.status_attributes.some((path) => !isPath(path)))) {
      throw new Error("Invalid popup status attributes.");
    }
    if (config.popup.width !== void 0 && (!Number.isInteger(config.popup.width) || config.popup.width < 320 || config.popup.width > 960)) {
      throw new Error("Popup width must be a whole number from 320 to 960 pixels.");
    }
    if (config.popup.actions !== void 0 && (!Array.isArray(config.popup.actions) || config.popup.actions.some(
      (action) => !action || !isEntity(action.entity) || !isService(action.service) || action.data !== void 0 && (!action.data || typeof action.data !== "object" || Array.isArray(action.data)) || action.name !== void 0 && (typeof action.name !== "string" || !action.name.trim()) || action.icon !== void 0 && typeof action.icon !== "string"
    ))) {
      throw new Error("Popup actions need an entity, a domain.service, and optional name, icon, and data.");
    }
    config.popup.sections.forEach(validateSection);
  }

  // src/styles.css
  var styles_default = ':host {\n  display: block;\n  min-width: 0;\n  height: 100%;\n  font-family: var(--ha-font-family-body, inherit);\n}\n.tile,\n.tile > * {\n  display: block;\n  height: 100%;\n  min-width: 0;\n}\n:host([compact]) {\n  height: auto;\n}\n:host([compact]) .tile,\n:host([compact]) .tile > * {\n  height: auto;\n}\n:host([badge]) {\n  display: inline-block;\n  height: auto;\n}\n:host([badge]) .tile,\n:host([badge]) .tile > * {\n  height: auto;\n}\n.summary-tile {\n  box-sizing: border-box;\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  width: 100%;\n  height: 100%;\n  min-height: 54px;\n  padding: 9px 10px;\n  border: 0;\n  border-radius: inherit;\n  background: transparent;\n  color: var(--primary-text-color);\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n}\n.summary-icon {\n  display: grid;\n  place-items: center;\n  flex: none;\n  width: 36px;\n  height: 36px;\n  border-radius: 50%;\n  background: var(--secondary-background-color, #333);\n}\n.summary-icon ha-icon {\n  --mdc-icon-size: 20px;\n  color: var(--secondary-text-color);\n}\n.summary-tile[data-active="true"] .summary-icon ha-icon {\n  color: var(--state-light-active-color, var(--primary-color));\n}\n.summary-copy {\n  min-width: 0;\n}\n.summary-name,\n.summary-state {\n  display: block;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.summary-name {\n  font-weight: var(--ha-font-weight-medium, 600);\n  line-height: 20px;\n}\n.summary-state {\n  color: var(--secondary-text-color);\n  font-size: 12px;\n  line-height: 16px;\n}\ndialog {\n  box-sizing: border-box;\n  width: min(var(--entity-popup-width, 480px), calc(100vw - 24px));\n  max-height: min(80dvh, 720px);\n  padding: 0;\n  border: 1px solid var(--divider-color, #555);\n  border-radius: var(--ha-border-radius-3xl, 24px);\n  color: var(--primary-text-color, #212121);\n  background: var(\n    --ha-color-surface-default,\n    var(--ha-card-background, var(--card-background-color, #fff))\n  );\n  box-shadow: var(--ha-box-shadow-l, 0 12px 40px #0006);\n  overflow: auto;\n}\ndialog::backdrop {\n  background: #0007;\n}\n.header {\n  position: sticky;\n  top: 0;\n  z-index: 1;\n  display: flex;\n  align-items: center;\n  gap: var(--ha-space-3, 12px);\n  padding-block: var(--ha-space-3, 12px);\n  padding-inline: var(--ha-space-3, 12px) var(--ha-space-5, 20px);\n  background: inherit;\n}\nh2 {\n  margin: 0;\n  flex: 1;\n  min-width: 0;\n  font-size: var(--ha-font-size-xl, 20px);\n  line-height: 28px;\n  font-weight: var(--ha-font-weight-medium, 600);\n}\n.close {\n  flex: none;\n  display: grid;\n  place-items: center;\n  width: 44px;\n  height: 44px;\n  border: 0;\n  border-radius: 50%;\n  background: transparent;\n  color: var(--primary-text-color);\n  cursor: pointer;\n}\n.close:hover,\n.switch:hover,\n.cover-action:hover {\n  background: var(--secondary-background-color, #8882);\n}\n.interactive-row:hover {\n  border-radius: 8px;\n  background: var(--secondary-background-color, #8882);\n}\n.interactive-row .switch:hover {\n  background: transparent;\n}\nbutton:focus-visible {\n  outline: 2px solid var(--primary-color);\n  outline-offset: 1px;\n}\n.body {\n  padding-block: var(--ha-space-4, 16px) var(--ha-space-6, 24px);\n  padding-inline: var(--ha-space-6, 24px);\n}\n.status,\n.empty,\n.unavailable {\n  margin: 0;\n  font-size: 14px;\n  line-height: 21px;\n  color: var(--secondary-text-color);\n  overflow-wrap: anywhere;\n}\n.status {\n  margin-block-end: var(--ha-space-3, 12px);\n}\n.section + .section {\n  margin-block-start: var(--ha-space-5, 20px);\n}\nh3 {\n  margin: 12px 0 4px;\n  font-size: var(--ha-font-size-m, 14px);\n  line-height: 20px;\n  font-weight: var(--ha-font-weight-medium, 600);\n  color: var(--secondary-text-color);\n}\nul {\n  list-style: none;\n  margin: 4px 0 0;\n  padding: 0;\n}\nli {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  min-height: 56px;\n  padding: 4px var(--ha-space-3, 12px);\n}\nli + li {\n  border-top: 1px solid var(--divider-color, #8883);\n}\nli ha-icon {\n  flex: none;\n  --mdc-icon-size: 22px;\n  color: var(--primary-color);\n}\n.copy {\n  flex: 1;\n  min-width: 0;\n}\n.name {\n  display: block;\n  font-size: var(--ha-font-size-m, 15px);\n  line-height: 22px;\n  overflow-wrap: anywhere;\n}\n.detail {\n  display: block;\n  font-size: var(--ha-font-size-s, 12px);\n  line-height: 18px;\n  color: var(--secondary-text-color);\n  overflow-wrap: anywhere;\n}\n.row-button {\n  flex: 1;\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  min-height: 48px;\n  padding: 0;\n  border: 0;\n  border-radius: 6px;\n  background: transparent;\n  color: inherit;\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n}\n.switch {\n  flex: none;\n  display: grid;\n  place-items: center;\n  width: 48px;\n  height: 44px;\n  padding: 0;\n  border: 0;\n  border-radius: 8px;\n  background: transparent;\n  cursor: pointer;\n}\n.switch:disabled {\n  cursor: default;\n  opacity: 0.45;\n}\n.switch[aria-busy="true"] {\n  cursor: wait;\n}\n.track {\n  display: block;\n  box-sizing: border-box;\n  width: 36px;\n  height: 22px;\n  padding: 3px;\n  border-radius: 12px;\n  background: var(--disabled-color, #777);\n  transition: background 120ms;\n}\n.thumb {\n  display: block;\n  width: 16px;\n  height: 16px;\n  margin-inline-start: 0;\n  border-radius: 50%;\n  background: var(--card-background-color, #fff);\n  transition: margin-inline-start 120ms;\n}\n.switch[aria-checked="true"] .track {\n  background: var(--state-light-active-color, var(--primary-color, #03a9f4));\n}\n.switch[aria-checked="true"] .thumb {\n  margin-inline-start: 14px;\n}\n.cover-action {\n  flex: none;\n  min-width: 64px;\n  min-height: 36px;\n  padding: 0 12px;\n  border: 1px solid var(--divider-color, #8883);\n  border-radius: 18px;\n  background: transparent;\n  color: var(--primary-color);\n  font: inherit;\n  font-size: 14px;\n  font-weight: var(--ha-font-weight-medium, 600);\n  cursor: pointer;\n}\n.cover-action:disabled {\n  cursor: default;\n  opacity: 0.45;\n}\n.section-footer {\n  display: flex;\n  justify-content: flex-end;\n  margin-top: 12px;\n}\n.bulk-button {\n  min-height: 44px;\n  padding: 0 16px;\n  border: 1px solid var(--divider-color, #8885);\n  border-radius: 22px;\n  background: transparent;\n  color: var(--primary-text-color);\n  font: inherit;\n  cursor: pointer;\n}\n.bulk-button:disabled {\n  cursor: default;\n  opacity: 0.45;\n}\n.actions {\n  margin-top: var(--ha-space-5, 20px);\n}\n.action-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));\n  gap: 10px;\n  margin-top: 10px;\n}\n.action-button {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  min-height: 52px;\n  padding: 8px 12px;\n  border: 1px solid var(--divider-color, #8885);\n  border-radius: 14px;\n  background: var(--secondary-background-color, #8882);\n  color: var(--primary-text-color);\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n}\n.action-button ha-icon {\n  flex: none;\n  --mdc-icon-size: 22px;\n  color: var(--primary-color);\n}\n.action-button:disabled {\n  cursor: default;\n  opacity: 0.45;\n}\n.empty {\n  padding: 12px 0 4px;\n}\n.unavailable {\n  padding-top: 8px;\n}\n.error {\n  margin: 12px 0 0;\n  color: var(--error-color, #db4437);\n  font-size: 13px;\n  line-height: 20px;\n  white-space: pre-line;\n  overflow-wrap: anywhere;\n}\nli[data-active="false"] > ha-icon,\nli[data-active="false"] .row-button > ha-icon:first-child {\n  color: var(--secondary-text-color);\n}\nli[data-active="true"] > ha-icon,\nli[data-active="true"] .row-button > ha-icon:first-child {\n  color: var(--state-light-active-color, var(--primary-color));\n}\n[hidden] {\n  display: none !important;\n}\n@media (max-width: 870px), (max-height: 500px) {\n  dialog {\n    inset: auto 0 0;\n    width: 100%;\n    max-width: none;\n    max-height: calc(100dvh - max(var(--safe-area-inset-top, 0px), 48px));\n    margin: 0;\n    border-radius: var(--ha-border-radius-3xl, 24px) var(--ha-border-radius-3xl, 24px) 0 0;\n    border-inline: 0;\n    border-bottom: 0;\n  }\n  .body {\n    padding-bottom: calc(var(--ha-space-6, 24px) + var(--safe-area-inset-bottom, 0px));\n  }\n}\n@media (prefers-reduced-motion: reduce) {\n  .track,\n  .thumb {\n    transition: none;\n  }\n}\n';

  // src/card.js
  var STATE_UPDATE_TIMEOUT_MS = 15e3;
  var EntityPopupCard = class extends HTMLElement {
    static getStubConfig(_hass, entities = []) {
      const entity = entities.find((id) => ENTITY.test(id)) || "sun.sun";
      return {
        entity,
        card: { type: "tile", entity },
        popup: {
          sections: [
            { source: "entities", entities: [entity], show_state: true, row_action: "more-info" }
          ]
        }
      };
    }
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._revision = 0;
      this._rows = /* @__PURE__ */ new Map();
      this._sectionNodes = /* @__PURE__ */ new Map();
      this._retained = /* @__PURE__ */ new Map();
      this._operations = /* @__PURE__ */ new Map();
      this._errors = /* @__PURE__ */ new Map();
      this._actionPending = /* @__PURE__ */ new Map();
      this._actionButtons = [];
      this.shadowRoot.innerHTML = `
      <style>${styles_default}</style>
      <div class="tile"></div>
      <dialog aria-labelledby="entity-popup-title" aria-describedby="entity-popup-status">
        <div class="header"><button class="close" type="button" aria-label="Close"><ha-icon icon="mdi:close" aria-hidden="true"></ha-icon></button><h2 id="entity-popup-title"></h2></div>
        <div class="body"><p class="status" id="entity-popup-status"></p><div class="sections"></div><div class="actions" hidden><h3></h3><div class="action-grid"></div></div><p class="error" role="alert" hidden></p></div>
      </dialog>`;
      this._tile = this.shadowRoot.querySelector(".tile");
      this._dialog = this.shadowRoot.querySelector("dialog");
      this._title = this.shadowRoot.querySelector("h2");
      this._status = this.shadowRoot.querySelector(".status");
      this._sections = this.shadowRoot.querySelector(".sections");
      this._actions = this.shadowRoot.querySelector(".actions");
      this._actionsTitle = this.shadowRoot.querySelector(".actions h3");
      this._actionGrid = this.shadowRoot.querySelector(".action-grid");
      this._error = this.shadowRoot.querySelector(".error");
      this._close = this.shadowRoot.querySelector(".close");
      this._close.addEventListener("click", () => this._dialog.close());
      this._dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        this._dialog.close();
      });
      this._dialog.addEventListener("click", (event) => {
        if (event.target !== this._dialog) return;
        const bounds = this._dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)
          this._dialog.close();
      });
      this._dialog.addEventListener("close", () => {
        this._retained.clear();
        this._rows.clear();
        this._sectionNodes.clear();
        this._sections.replaceChildren();
        this._errors.clear();
        if (this.isConnected && this._opener?.isConnected)
          this._opener.focus({ preventScroll: true });
        this._opener = null;
      });
      this.addEventListener("hass-action", (event) => {
        const detail = event.detail;
        if (detail?.action !== "tap" || detail.config?.tap_action?.action !== "fire-dom-event" || !event.composedPath().includes(this._card))
          return;
        event.stopPropagation();
        this._openDialog();
      });
      this.addEventListener("ll-custom", (event) => {
        if (event.detail?.action !== "fire-dom-event" || !event.composedPath().includes(this._card))
          return;
        event.stopPropagation();
        this._openDialog();
      });
    }
    setConfig(config) {
      validateConfig(config);
      this._config = config;
      if (config.popup.width === void 0) this._dialog.style.removeProperty("--entity-popup-width");
      else this._dialog.style.setProperty("--entity-popup-width", `${config.popup.width}px`);
      if (config.compact) this.setAttribute("compact", "");
      else this.removeAttribute("compact");
      this._revision++;
      if (this._dialog.open) this._dialog.close();
      this._clearOperations();
      this._actionPending.clear();
      this._actionButtons = [];
      this._actionGrid.replaceChildren();
      this._card?.remove();
      this._card = null;
      this._summaryParts = null;
      this._tile.textContent = "";
      if (this.isConnected) this._buildCard();
    }
    connectedCallback() {
      this._buildCard();
    }
    disconnectedCallback() {
      this._revision++;
      if (this._dialog.open) this._dialog.close();
      this._clearOperations();
      this._actionPending.clear();
    }
    set hass(hass) {
      this._hass = hass;
      if (this._card && this.isConnected && !this._config?.summary_tile) this._card.hass = hass;
      this._renderSummaryTile();
      this._settleOperations();
      if (this._dialog.open) this._renderDialog();
    }
    set layout(layout) {
      this._layout = layout;
      if (this._card) this._card.layout = layout;
    }
    getCardSize() {
      return this._card?.getCardSize?.() ?? 1;
    }
    getGridOptions() {
      return this._card?.getGridOptions?.() ?? { columns: 6, rows: 1 };
    }
    async _buildCard() {
      if (!this._config || !this.isConnected) return;
      if (this._card) {
        if (!this._config.summary_tile) this._card.hass = this._hass;
        this._renderSummaryTile();
        return;
      }
      if (this._config.summary_tile) {
        this._buildSummaryTile();
        return;
      }
      const revision = ++this._revision;
      try {
        const helpers = await window.loadCardHelpers();
        if (revision !== this._revision || !this.isConnected) return;
        const { popup, compact, card: configuredCard, ...tileConfig } = this._config;
        const baseCard = configuredCard || { ...tileConfig, type: "custom:mushroom-template-card" };
        const card = helpers.createCardElement({
          ...baseCard,
          entity: baseCard.entity || this._config.entity,
          tap_action: { action: "fire-dom-event" }
        });
        this._card = card;
        card.layout = this._layout;
        if (this._hass) card.hass = this._hass;
        this._tile.replaceChildren(card);
      } catch (error) {
        if (revision !== this._revision || !this.isConnected) return;
        this._tile.textContent = "Details unavailable";
        console.error("Unable to load entity popup card", error);
      }
    }
    _buildSummaryTile() {
      const card = document.createElement("ha-card");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "summary-tile";
      const iconBox = document.createElement("span");
      iconBox.className = "summary-icon";
      const icon = document.createElement("ha-icon");
      icon.setAttribute("aria-hidden", "true");
      iconBox.append(icon);
      const copy = document.createElement("span");
      copy.className = "summary-copy";
      const name = document.createElement("span");
      name.className = "summary-name";
      const state = document.createElement("span");
      state.className = "summary-state";
      copy.append(name, state);
      button.append(iconBox, copy);
      button.addEventListener("click", () => this._openDialog());
      card.append(button);
      this._card = card;
      this._summaryParts = { button, icon, name, state };
      this._tile.replaceChildren(card);
      this._renderSummaryTile();
    }
    _sectionSummary(snapshot, section) {
      if (section.source !== "members" && !(section.source === "entities" && section.mode === "controls"))
        return "";
      if (!snapshot.membershipKnown) return "Items unavailable";
      const count = snapshot.activeCount;
      const noun = count === 1 ? section.singular || "item" : section.plural || "items";
      const control = section.mode === "controls" && section.domain ? CONTROL_TYPES.get(section.domain) : null;
      const unavailable = snapshot.allItems.filter(
        (item) => ["unknown", "unavailable"].includes(item.state)
      ).length;
      return `${count} ${noun} ${section.active_label || control?.activeLabel || "active"}${unavailable ? ` \xB7 ${unavailable} unavailable` : ""}${snapshot.sourceAvailable ? "" : " \xB7 Source unavailable"}`;
    }
    _renderSummaryTile() {
      if (!this._summaryParts || !this._config?.summary_tile) return;
      const { button, icon, name, state } = this._summaryParts;
      const section = this._config.popup.sections[0];
      const snapshot = collectSection(this._hass?.states, this._config.entity, section);
      name.textContent = this._config.summary_tile.name;
      state.textContent = this._sectionSummary(snapshot, section) || `${snapshot.items.length} items`;
      icon.icon = this._config.summary_tile.icon || this._hass?.states?.[this._config.entity]?.attributes?.icon || "mdi:format-list-bulleted";
      button.dataset.active = String(snapshot.activeCount > 0);
      button.setAttribute("aria-label", `${name.textContent}, ${state.textContent}`);
    }
    _openDialog() {
      if (!this.isConnected || this._dialog.open) return;
      let active = document.activeElement;
      while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
      this._opener = active && active !== document.body ? active : null;
      this._retained.clear();
      this._errors.clear();
      this._renderDialog();
      this._dialog.showModal();
      this._close.focus({ preventScroll: true });
    }
    _sectionNode(index, section) {
      const existing = this._sectionNodes.get(index);
      if (existing) return existing;
      const node = document.createElement("div");
      node.className = "section";
      const heading = document.createElement("h3");
      heading.textContent = section.title || "";
      heading.hidden = !section.title;
      const list = document.createElement("ul");
      list.setAttribute("aria-label", section.title || this._config.popup.title || "Details");
      const empty = document.createElement("p");
      empty.className = "empty";
      const missing = document.createElement("p");
      missing.className = "unavailable";
      const footer = document.createElement("div");
      footer.className = "section-footer";
      footer.hidden = !section.bulk_label;
      const bulk = document.createElement("button");
      bulk.type = "button";
      bulk.className = "bulk-button";
      bulk.textContent = section.bulk_label || "";
      bulk.addEventListener("click", () => this._bulkChange(index));
      footer.append(bulk);
      node.append(heading, list, empty, missing, footer);
      const parts = { list, empty, missing, bulk };
      this._sectionNodes.set(index, parts);
      this._sections.append(node);
      return parts;
    }
    _detail(item, section) {
      const parts = [];
      if (section.show_state && item.entity) {
        const state = this._hass?.states?.[item.entity];
        const label = section.state_labels?.[item.state] || state && this._hass?.formatEntityState?.(state) || readable(item.state);
        parts.push(label);
      }
      for (const detail of section.details || []) {
        const value = detail.attribute ? atPath(item.attributes, detail.attribute) : item[detail.field];
        if (value == null || value === "" || Array.isArray(value) || typeof value === "object")
          continue;
        let display = String(value);
        if (detail.format === "datetime") {
          const date = new Date(value);
          if (Number.isNaN(date.getTime())) continue;
          display = date.toLocaleString(void 0, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit"
          });
        }
        parts.push(`${detail.label ? `${detail.label} ` : ""}${display}${detail.unit || ""}`);
      }
      return parts.join(" \xB7 ");
    }
    _renderDialog() {
      const config = this._config.popup;
      const source = this._hass?.states?.[this._config.entity];
      this._title.textContent = config.title || this._config.dialog_title || source?.attributes?.friendly_name || "Details";
      const snapshots = config.sections.map(
        (section) => collectSection(this._hass?.states, this._config.entity, section)
      );
      if (config.status_attribute || config.status_attributes) {
        const paths = config.status_attributes || [config.status_attribute];
        const values = source && !["unknown", "unavailable"].includes(source.state) ? paths.map((path) => atPath(source.attributes, path)).filter((value) => ["string", "number"].includes(typeof value) && value !== "") : [];
        this._status.textContent = values.length ? values.map(readable).join(" \xB7 ") : "Status unavailable";
      } else if (config.status_text) {
        this._status.textContent = config.status_text;
      } else {
        this._status.textContent = this._sectionSummary(snapshots[0], config.sections[0]);
      }
      this._status.hidden = !this._status.textContent;
      if (this._status.hidden) this._dialog.removeAttribute("aria-describedby");
      else this._dialog.setAttribute("aria-describedby", "entity-popup-status");
      const keepRows = /* @__PURE__ */ new Set();
      for (const [index, section] of config.sections.entries()) {
        const snapshot = snapshots[index];
        const { list, empty, missing, bulk } = this._sectionNode(index, section);
        const current = new Map(
          snapshot.allItems.filter((item) => item.entity).map((item) => [item.entity, item])
        );
        let items = snapshot.items;
        if (section.mode === "controls" && section.show === "active") {
          const sectionKey = `${index}:`;
          for (const item of snapshot.items) {
            if (isActive(controlFor(item.entity), item.state)) {
              this._retained.set(`${index}:${item.entity}`, item);
            }
          }
          for (const [key, item] of this._retained) {
            if (!key.startsWith(sectionKey)) continue;
            if (snapshot.membershipKnown && !snapshot.memberIds.has(item.entity)) {
              this._retained.delete(key);
            } else {
              this._retained.set(
                key,
                current.get(item.entity) || entityItem(this._hass?.states, item.entity, section)
              );
            }
          }
          items = [...this._retained].filter(([key]) => key.startsWith(sectionKey)).map(([, item]) => item);
          if (section.source === "entities") {
            const order = new Map(snapshot.allItems.map((item, position) => [item.entity, position]));
            items.sort((a, b) => order.get(a.entity) - order.get(b.entity));
          } else {
            items.sort(sortName);
          }
        }
        for (const [rowIndex, item] of items.entries()) {
          const key = `${index}:${item.key}`;
          const domainControl = section.mode === "controls" ? controlFor(item.entity) : null;
          const itemActive = domainControl ? isActive(domainControl, item.state) : item.state === (section.active_state || "on");
          keepRows.add(key);
          let parts = this._rows.get(key);
          if (!parts) {
            const row = document.createElement("li");
            const icon = document.createElement("ha-icon");
            icon.setAttribute("aria-hidden", "true");
            const copy = document.createElement("span");
            copy.className = "copy";
            const name = document.createElement("span");
            name.className = "name";
            const detail2 = document.createElement("span");
            detail2.className = "detail";
            copy.append(name, detail2);
            let control, rowButton;
            if (section.row_action === "more-info" && item.entity) {
              rowButton = document.createElement("button");
              rowButton.type = "button";
              rowButton.className = "row-button";
              row.className = "interactive-row";
              rowButton.append(icon, copy);
              rowButton.addEventListener("click", () => this._moreInfo(item.entity));
              row.append(rowButton);
            } else row.append(icon, copy);
            if (section.mode === "controls") {
              control = document.createElement("button");
              control.type = "button";
              if (domainControl?.presentation === "button") {
                control.className = "cover-action";
              } else {
                control.className = "switch";
                control.setAttribute("role", "switch");
                const track = document.createElement("span");
                track.className = "track";
                track.setAttribute("aria-hidden", "true");
                const thumb = document.createElement("span");
                thumb.className = "thumb";
                track.append(thumb);
                control.append(track);
              }
              control.addEventListener("click", () => this._change(index, item.entity));
              row.append(control);
            } else control = rowButton;
            parts = { row, icon, name, detail: detail2, control, rowButton };
            this._rows.set(key, parts);
          }
          parts.icon.icon = item.icon || (itemActive ? section.active_icon : section.inactive_icon) || section.icon || "mdi:circle-outline";
          parts.icon.style.color = item.color || "";
          parts.row.setAttribute("data-state", item.state);
          parts.row.setAttribute("data-active", String(itemActive));
          parts.name.textContent = item.name;
          const detail = this._detail(item, section);
          parts.detail.textContent = detail;
          parts.detail.hidden = !detail;
          if (section.mode === "controls") {
            const busy = this._operations.has(key);
            const action = domainControl ? actionFor(domainControl, item.state) : null;
            parts.control.setAttribute(
              "aria-label",
              domainControl?.presentation === "button" ? `${action?.label || "Control"} ${item.name}` : item.name
            );
            if (domainControl?.presentation === "button") {
              parts.control.textContent = action?.label || "Moving";
            } else {
              parts.control.setAttribute("aria-checked", String(itemActive));
            }
            parts.control.setAttribute("aria-busy", String(busy));
            parts.control.disabled = !action || busy || this._actionPending.size > 0 || !snapshot.membershipKnown || !snapshot.memberIds.has(item.entity);
            parts.control.title = busy ? "Updating\u2026" : action?.label || "Unavailable";
            if (parts.rowButton)
              parts.rowButton.setAttribute("aria-label", `${item.name}. More information`);
          } else if (section.row_action === "more-info" && parts.control)
            parts.control.setAttribute("aria-label", `${item.name}. More information`);
          if (list.children[rowIndex] !== parts.row)
            list.insertBefore(parts.row, list.children[rowIndex] || null);
        }
        empty.hidden = items.length > 0;
        empty.textContent = !snapshot.membershipKnown ? "Items cannot be listed right now." : section.empty_text || "Nothing to show.";
        const visibleKeys = new Set(items.map((item) => item.key));
        const unavailable = snapshot.unavailable.filter((item) => !visibleKeys.has(item.key));
        missing.hidden = unavailable.length === 0;
        missing.textContent = unavailable.length ? `Unavailable: ${unavailable.map((item) => item.name).join(", ")}` : "";
        if (section.bulk_label) {
          const actionable = snapshot.allItems.some((item) => {
            const control = controlFor(item.entity);
            return control && isActive(control, item.state) && actionFor(control, item.state);
          });
          bulk.disabled = !snapshot.membershipKnown || !actionable || this._operations.size > 0 || this._actionPending.size > 0;
        }
      }
      for (const [key, parts] of this._rows)
        if (!keepRows.has(key)) {
          parts.row.remove();
          this._rows.delete(key);
        }
      this._renderActions();
      this._error.hidden = this._errors.size === 0;
      this._error.textContent = [...this._errors.values()].map((error) => `${error.name}: ${error.message}`).join("\n");
    }
    _renderActions() {
      const actions = this._config.popup.actions || [];
      this._actions.hidden = !actions.length;
      if (!actions.length) return;
      this._actionsTitle.textContent = this._config.popup.actions_title || "Actions";
      for (const [index, action] of actions.entries()) {
        let parts = this._actionButtons[index];
        if (!parts) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "action-button";
          const icon = document.createElement("ha-icon");
          icon.setAttribute("aria-hidden", "true");
          const name = document.createElement("span");
          button.append(icon, name);
          button.addEventListener("click", () => this._runAction(index));
          this._actionGrid.append(button);
          parts = { button, icon, name };
          this._actionButtons[index] = parts;
        }
        const record = this._hass?.states?.[action.entity];
        const available = !!record && !["unknown", "unavailable"].includes(record.state);
        parts.name.textContent = action.name || record?.attributes?.friendly_name || action.entity;
        parts.icon.icon = action.icon || record?.attributes?.icon || "mdi:play";
        parts.button.disabled = !available || this._actionPending.size > 0 || this._operations.size > 0;
        parts.button.setAttribute(
          "aria-label",
          available ? parts.name.textContent : `${parts.name.textContent} unavailable`
        );
        parts.button.setAttribute("aria-busy", String(this._actionPending.has(index)));
      }
    }
    async _runAction(index) {
      const action = this._config.popup.actions?.[index];
      const state = this._hass?.states?.[action?.entity]?.state;
      if (!this.isConnected || !this._dialog.open || !action || !state || ["unknown", "unavailable"].includes(state) || this._actionPending.size || this._operations.size || typeof this._hass?.callService !== "function")
        return;
      const pending = {};
      this._actionPending.set(index, pending);
      this._errors.delete(`action:${index}`);
      this._renderDialog();
      try {
        const [domain, service] = action.service.split(".");
        await this._hass.callService(domain, service, { ...action.data, entity_id: action.entity });
      } catch (_) {
        if (this._actionPending.get(index) === pending)
          this._errors.set(`action:${index}`, {
            name: action.name || action.entity,
            message: "Couldn't run the action. Try again."
          });
      } finally {
        if (this._actionPending.get(index) === pending) this._actionPending.delete(index);
        if (this._dialog.open) this._renderDialog();
      }
    }
    async _bulkChange(index) {
      const section = this._config.popup.sections[index];
      if (!this.isConnected || !this._dialog.open || section?.mode !== "controls" || !section.bulk_label || this._operations.size || this._actionPending.size || typeof this._hass?.callService !== "function")
        return;
      const snapshot = collectSection(this._hass?.states, this._config.entity, section);
      if (!snapshot.membershipKnown) return;
      const groups = /* @__PURE__ */ new Map();
      for (const item of snapshot.allItems) {
        const control = controlFor(item.entity);
        if (!control || !isActive(control, item.state)) continue;
        const action = actionFor(control, item.state);
        if (!action) continue;
        const domain = item.entity.split(".")[0];
        const groupKey = `${domain}.${action.service}`;
        if (!groups.has(groupKey)) groups.set(groupKey, []);
        groups.get(groupKey).push({ key: `${index}:${item.entity}`, entity: item.entity, domain, action });
      }
      await Promise.all([...groups.values()].map((changes) => this._sendControlGroup(changes)));
    }
    _moreInfo(entityId) {
      if (!ENTITY.test(entityId || "")) return;
      this._dialog.close();
      this.dispatchEvent(
        new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } })
      );
    }
    async _change(index, entity) {
      const section = this._config.popup.sections[index];
      const key = `${index}:${entity}`;
      if (!this.isConnected || !this._dialog.open || section.mode !== "controls" || this._operations.has(key) || this._actionPending.size > 0)
        return;
      const snapshot = collectSection(this._hass?.states, this._config.entity, {
        ...section,
        show: "all"
      });
      if (!snapshot.membershipKnown || !snapshot.memberIds.has(entity)) return;
      const state = this._hass?.states?.[entity]?.state;
      const control = controlFor(entity);
      const action = control && actionFor(control, state);
      if (!action || typeof this._hass?.callService !== "function") return;
      await this._sendControlGroup([{ key, entity, domain: entity.split(".")[0], action }]);
    }
    async _sendControlGroup(changes) {
      const pending = changes.map(({ key, entity, action }) => {
        const operation = { confirmedStates: action.confirmedStates, settled: false, timer: null };
        this._operations.set(key, operation);
        this._errors.delete(key);
        return { key, entity, operation };
      });
      this._renderDialog();
      try {
        const { domain, action } = changes[0];
        const entityIds = changes.map((change) => change.entity);
        await this._hass.callService(domain, action.service, {
          entity_id: entityIds.length === 1 ? entityIds[0] : entityIds
        });
        for (const { key, entity, operation } of pending) {
          if (this._operations.get(key) !== operation) continue;
          if (operation.confirmedStates.includes(this._hass?.states?.[entity]?.state)) {
            this._operations.delete(key);
          } else {
            operation.settled = true;
            operation.timer = setTimeout(
              () => this._finishOperation(key, operation, entity, "No update received. Try again."),
              STATE_UPDATE_TIMEOUT_MS
            );
          }
        }
        if (this._dialog.open) this._renderDialog();
      } catch (_) {
        for (const { key, entity, operation } of pending)
          this._finishOperation(
            key,
            operation,
            entity,
            "Couldn't change the item. Try again.",
            false
          );
        if (this._dialog.open) this._renderDialog();
      }
    }
    _finishOperation(key, operation, entity, message, render = true) {
      if (this._operations.get(key) !== operation) return;
      clearTimeout(operation.timer);
      this._operations.delete(key);
      if (message)
        this._errors.set(key, {
          entity,
          confirmedStates: operation.confirmedStates,
          name: this._hass?.states?.[entity]?.attributes?.friendly_name || entity,
          message
        });
      if (render && this._dialog.open) this._renderDialog();
    }
    _settleOperations() {
      for (const [key, operation] of this._operations) {
        const entity = key.slice(key.indexOf(":") + 1);
        if (operation.settled && operation.confirmedStates.includes(this._hass?.states?.[entity]?.state)) {
          clearTimeout(operation.timer);
          this._operations.delete(key);
        }
      }
      for (const [key, error] of this._errors)
        if (error.confirmedStates?.includes(this._hass?.states?.[error.entity]?.state))
          this._errors.delete(key);
    }
    _clearOperations() {
      for (const operation of this._operations.values()) clearTimeout(operation.timer);
      this._operations.clear();
    }
  };

  // src/badge.js
  var EntityPopupBadge = class extends EntityPopupCard {
    setConfig(config) {
      this.setAttribute("badge", "");
      super.setConfig(config);
    }
    async _buildCard() {
      if (!this._config || !this.isConnected) return;
      if (this._card) {
        this._card.hass = this._hass;
        return;
      }
      const revision = ++this._revision;
      try {
        await customElements.whenDefined("mushroom-template-badge");
        if (revision !== this._revision || !this.isConnected) return;
        const { popup, compact, card, grid_options, visibility, type, ...badgeConfig } = this._config;
        const badge = document.createElement("mushroom-template-badge");
        badge.setConfig({ ...badgeConfig, tap_action: { action: "fire-dom-event" } });
        this._card = badge;
        if (this._hass) badge.hass = this._hass;
        this._tile.replaceChildren(badge);
      } catch (error) {
        if (revision !== this._revision || !this.isConnected) return;
        this._tile.textContent = "Details unavailable";
        console.error("Unable to load entity popup badge", error);
      }
    }
  };

  // src/index.js
  if (!customElements.get("entity-popup-card"))
    customElements.define("entity-popup-card", EntityPopupCard);
  if (!customElements.get("entity-popup-badge"))
    customElements.define("entity-popup-badge", EntityPopupBadge);
  window.customBadges = window.customBadges || [];
  if (!window.customBadges.some((badge) => badge.type === "entity-popup-badge")) {
    window.customBadges.push({
      type: "entity-popup-badge",
      name: "Entity Popup Badge",
      description: "A compact status badge that opens a live list of related entities."
    });
  }
  window.customCards = window.customCards || [];
  if (!window.customCards.some((card) => card.type === "entity-popup-card")) {
    window.customCards.push({
      type: "entity-popup-card",
      name: "Entity Popup Card",
      description: "A simple tile with a live list of related entities.",
      documentationURL: "https://github.com/alphasixtyfive/entity-popup-card",
      getEntitySuggestion: (hass, entityId) => {
        const domain = entityId?.split(".")[0];
        if (!CONTROL_TYPES.has(domain) || !Array.isArray(hass?.states?.[entityId]?.attributes?.entity_id))
          return null;
        return {
          config: {
            type: "custom:entity-popup-card",
            entity: entityId,
            card: { type: "tile", entity: entityId },
            popup: {
              sections: [
                {
                  source: "members",
                  recursive: true,
                  domain,
                  mode: "controls",
                  show: "active",
                  show_state: true,
                  row_action: "more-info"
                }
              ]
            }
          }
        };
      }
    });
  }
})();
