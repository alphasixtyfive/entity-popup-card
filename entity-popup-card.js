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
  var SOURCES = /* @__PURE__ */ new Set(["members", "entities", "match", "values"]);
  var MODES = /* @__PURE__ */ new Set(["view", "controls"]);
  var PROTOTYPE_KEYS = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
  var readable = (value) => String(value ?? "").replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  var sortName = (a, b) => a.name.localeCompare(b.name, void 0, { numeric: true, sensitivity: "base" });
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
  function entityItem(states, id, section, name) {
    const record = states?.[id];
    return {
      key: id,
      entity: id,
      name: name || record?.attributes?.friendly_name || id,
      state: record?.state ?? "unavailable",
      icon: record?.attributes?.icon || section.icon,
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
      sourceAvailable: !["members", "values"].includes(section.source) || !!root && !["unknown", "unavailable"].includes(root.state)
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
        add(entityItem(states, id, section, typeof entry === "object" ? entry.name : void 0));
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
    if (!isEntity(config?.entity) || !Array.isArray(config.popup?.sections) || !config.popup.sections.length) {
      throw new Error("Entity Popup Card needs an entity and at least one popup section.");
    }
    if (config.card && (typeof config.card !== "object" || Array.isArray(config.card) || typeof config.card.type !== "string" || !config.card.type)) {
      throw new Error("The card option needs a Lovelace card type.");
    }
    if (config.popup.status_attribute && !isPath(config.popup.status_attribute)) {
      throw new Error("Invalid popup status attribute.");
    }
    if (config.popup.status_attributes && (!Array.isArray(config.popup.status_attributes) || config.popup.status_attributes.some((path) => !isPath(path)))) {
      throw new Error("Invalid popup status attributes.");
    }
    config.popup.sections.forEach(validateSection);
  }

  // src/styles.css
  var styles_default = ':host {\n  display: block;\n  min-width: 0;\n  height: 100%;\n  font-family: var(--ha-font-family-body, inherit);\n}\n.tile,\n.tile > * {\n  display: block;\n  height: 100%;\n  min-width: 0;\n}\n:host([compact]) {\n  height: auto;\n}\n:host([compact]) .tile,\n:host([compact]) .tile > * {\n  height: auto;\n}\ndialog {\n  box-sizing: border-box;\n  width: min(480px, calc(100vw - 24px));\n  max-height: min(80dvh, 720px);\n  padding: 0;\n  border: 1px solid var(--divider-color, #555);\n  border-radius: var(--ha-border-radius-3xl, 24px);\n  color: var(--primary-text-color, #212121);\n  background: var(\n    --ha-color-surface-default,\n    var(--ha-card-background, var(--card-background-color, #fff))\n  );\n  box-shadow: var(--ha-box-shadow-l, 0 12px 40px #0006);\n  overflow: auto;\n}\ndialog::backdrop {\n  background: #0007;\n}\n.header {\n  position: sticky;\n  top: 0;\n  z-index: 1;\n  display: flex;\n  align-items: center;\n  gap: var(--ha-space-3, 12px);\n  padding-block: var(--ha-space-3, 12px);\n  padding-inline: var(--ha-space-3, 12px) var(--ha-space-5, 20px);\n  background: inherit;\n}\nh2 {\n  margin: 0;\n  flex: 1;\n  min-width: 0;\n  font-size: var(--ha-font-size-xl, 20px);\n  line-height: 28px;\n  font-weight: var(--ha-font-weight-medium, 600);\n}\n.close {\n  flex: none;\n  display: grid;\n  place-items: center;\n  width: 44px;\n  height: 44px;\n  border: 0;\n  border-radius: 50%;\n  background: transparent;\n  color: var(--primary-text-color);\n  cursor: pointer;\n}\n.close:hover,\n.row-button:hover,\n.switch:hover,\n.cover-action:hover {\n  background: var(--secondary-background-color, #8882);\n}\nbutton:focus-visible {\n  outline: 2px solid var(--primary-color);\n  outline-offset: 1px;\n}\n.body {\n  padding-block: var(--ha-space-4, 16px) var(--ha-space-6, 24px);\n  padding-inline: var(--ha-space-6, 24px);\n}\n.status,\n.empty,\n.unavailable {\n  margin: 0;\n  font-size: 14px;\n  line-height: 21px;\n  color: var(--secondary-text-color);\n  overflow-wrap: anywhere;\n}\n.status {\n  margin-block-end: var(--ha-space-3, 12px);\n}\n.section + .section {\n  margin-block-start: var(--ha-space-5, 20px);\n}\nh3 {\n  margin: 12px 0 4px;\n  font-size: var(--ha-font-size-m, 14px);\n  line-height: 20px;\n  font-weight: var(--ha-font-weight-medium, 600);\n  color: var(--secondary-text-color);\n}\nul {\n  list-style: none;\n  margin: 4px 0 0;\n  padding: 0;\n}\nli {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  min-height: 56px;\n  padding: 4px 0;\n}\nli + li {\n  border-top: 1px solid var(--divider-color, #8883);\n}\nli ha-icon {\n  flex: none;\n  --mdc-icon-size: 22px;\n  color: var(--primary-color);\n}\n.copy {\n  flex: 1;\n  min-width: 0;\n}\n.name {\n  display: block;\n  font-size: var(--ha-font-size-m, 15px);\n  line-height: 22px;\n  overflow-wrap: anywhere;\n}\n.detail {\n  display: block;\n  font-size: var(--ha-font-size-s, 12px);\n  line-height: 18px;\n  color: var(--secondary-text-color);\n  overflow-wrap: anywhere;\n}\n.row-button {\n  flex: 1;\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  min-height: 48px;\n  padding: 0;\n  border: 0;\n  border-radius: 6px;\n  background: transparent;\n  color: inherit;\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n}\n.row-button ha-icon:last-child {\n  color: var(--secondary-text-color);\n  --mdc-icon-size: 18px;\n}\n.switch {\n  flex: none;\n  display: grid;\n  place-items: center;\n  width: 48px;\n  height: 44px;\n  padding: 0;\n  border: 0;\n  border-radius: 8px;\n  background: transparent;\n  cursor: pointer;\n}\n.switch:disabled {\n  cursor: default;\n  opacity: 0.45;\n}\n.switch[aria-busy="true"] {\n  cursor: wait;\n}\n.track {\n  display: block;\n  box-sizing: border-box;\n  width: 36px;\n  height: 22px;\n  padding: 3px;\n  border-radius: 12px;\n  background: var(--disabled-color, #777);\n  transition: background 120ms;\n}\n.thumb {\n  display: block;\n  width: 16px;\n  height: 16px;\n  margin-inline-start: 0;\n  border-radius: 50%;\n  background: var(--card-background-color, #fff);\n  transition: margin-inline-start 120ms;\n}\n.switch[aria-checked="true"] .track {\n  background: var(--state-light-active-color, var(--primary-color, #03a9f4));\n}\n.switch[aria-checked="true"] .thumb {\n  margin-inline-start: 14px;\n}\n.cover-action {\n  flex: none;\n  min-width: 64px;\n  min-height: 36px;\n  padding: 0 12px;\n  border: 1px solid var(--divider-color, #8883);\n  border-radius: 18px;\n  background: transparent;\n  color: var(--primary-color);\n  font: inherit;\n  font-size: 14px;\n  font-weight: var(--ha-font-weight-medium, 600);\n  cursor: pointer;\n}\n.cover-action:disabled {\n  cursor: default;\n  opacity: 0.45;\n}\n.empty {\n  padding: 12px 0 4px;\n}\n.unavailable {\n  padding-top: 8px;\n}\n.error {\n  margin: 12px 0 0;\n  color: var(--error-color, #db4437);\n  font-size: 13px;\n  line-height: 20px;\n  white-space: pre-line;\n  overflow-wrap: anywhere;\n}\nli[data-active="false"] > ha-icon,\nli[data-active="false"] .row-button > ha-icon:first-child {\n  color: var(--secondary-text-color);\n}\nli[data-active="true"] > ha-icon,\nli[data-active="true"] .row-button > ha-icon:first-child {\n  color: var(--state-light-active-color, var(--primary-color));\n}\n[hidden] {\n  display: none !important;\n}\n@media (max-width: 870px), (max-height: 500px) {\n  dialog {\n    inset: auto 0 0;\n    width: 100%;\n    max-width: none;\n    max-height: calc(100dvh - max(var(--safe-area-inset-top, 0px), 48px));\n    margin: 0;\n    border-radius: var(--ha-border-radius-3xl, 24px) var(--ha-border-radius-3xl, 24px) 0 0;\n    border-inline: 0;\n    border-bottom: 0;\n  }\n  .body {\n    padding-bottom: calc(var(--ha-space-6, 24px) + var(--safe-area-inset-bottom, 0px));\n  }\n}\n@media (prefers-reduced-motion: reduce) {\n  .track,\n  .thumb {\n    transition: none;\n  }\n}\n';

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
      this.shadowRoot.innerHTML = `
      <style>${styles_default}</style>
      <div class="tile"></div>
      <dialog aria-labelledby="entity-popup-title" aria-describedby="entity-popup-status">
        <div class="header"><button class="close" type="button" aria-label="Close"><ha-icon icon="mdi:close" aria-hidden="true"></ha-icon></button><h2 id="entity-popup-title"></h2></div>
        <div class="body"><p class="status" id="entity-popup-status"></p><div class="sections"></div><p class="error" role="alert" hidden></p></div>
      </dialog>`;
      this._tile = this.shadowRoot.querySelector(".tile");
      this._dialog = this.shadowRoot.querySelector("dialog");
      this._title = this.shadowRoot.querySelector("h2");
      this._status = this.shadowRoot.querySelector(".status");
      this._sections = this.shadowRoot.querySelector(".sections");
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
      if (config.compact) this.setAttribute("compact", "");
      else this.removeAttribute("compact");
      this._revision++;
      if (this._dialog.open) this._dialog.close();
      this._clearOperations();
      this._card?.remove();
      this._card = null;
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
    }
    set hass(hass) {
      this._hass = hass;
      if (this._card && this.isConnected) this._card.hass = hass;
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
        this._card.hass = this._hass;
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
      node.append(heading, list, empty, missing);
      const parts = { list, empty, missing };
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
      for (const [key, operation] of this._operations) {
        const entity = key.slice(key.indexOf(":") + 1);
        if (operation.settled && operation.confirmedStates.includes(this._hass?.states?.[entity]?.state)) {
          clearTimeout(operation.timer);
          this._operations.delete(key);
        }
      }
      for (const [key, error] of this._errors)
        if (error.confirmedStates.includes(this._hass?.states?.[error.entity]?.state))
          this._errors.delete(key);
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
        const first = snapshots[0];
        const section = config.sections[0];
        const count = first.activeCount;
        const noun = count === 1 ? section.singular || "item" : section.plural || "items";
        const control = section.mode === "controls" && section.domain ? CONTROL_TYPES.get(section.domain) : null;
        this._status.textContent = section.source !== "members" ? "" : !first.membershipKnown ? "Items unavailable" : `${count} ${noun} ${section.active_label || control?.activeLabel || "active"}${first.sourceAvailable ? "" : " \xB7 Source unavailable"}`;
      }
      this._status.hidden = !this._status.textContent;
      if (this._status.hidden) this._dialog.removeAttribute("aria-describedby");
      else this._dialog.setAttribute("aria-describedby", "entity-popup-status");
      const keepRows = /* @__PURE__ */ new Set();
      for (const [index, section] of config.sections.entries()) {
        const snapshot = snapshots[index];
        const { list, empty, missing } = this._sectionNode(index, section);
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
              const chevron = document.createElement("ha-icon");
              chevron.icon = "mdi:chevron-right";
              chevron.setAttribute("aria-hidden", "true");
              rowButton.append(icon, copy, chevron);
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
            parts.control.disabled = !action || busy || !snapshot.membershipKnown || !snapshot.memberIds.has(item.entity);
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
      }
      for (const [key, parts] of this._rows)
        if (!keepRows.has(key)) {
          parts.row.remove();
          this._rows.delete(key);
        }
      this._error.hidden = this._errors.size === 0;
      this._error.textContent = [...this._errors.values()].map((error) => `${error.name}: ${error.message}`).join("\n");
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
      if (!this.isConnected || !this._dialog.open || section.mode !== "controls" || this._operations.has(key))
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
      const operation = { confirmedStates: action.confirmedStates, settled: false, timer: null };
      this._operations.set(key, operation);
      this._errors.delete(key);
      this._renderDialog();
      try {
        await this._hass.callService(entity.split(".")[0], action.service, { entity_id: entity });
        if (this._operations.get(key) !== operation) return;
        operation.settled = true;
        operation.timer = setTimeout(
          () => this._finishOperation(key, operation, entity, "No update received. Try again."),
          STATE_UPDATE_TIMEOUT_MS
        );
        if (this._dialog.open) this._renderDialog();
      } catch (_) {
        this._finishOperation(key, operation, entity, "Couldn't change the item. Try again.");
      }
    }
    _finishOperation(key, operation, entity, message) {
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
      if (this._dialog.open) this._renderDialog();
    }
    _clearOperations() {
      for (const operation of this._operations.values()) clearTimeout(operation.timer);
      this._operations.clear();
    }
  };

  // src/index.js
  if (!customElements.get("entity-popup-card"))
    customElements.define("entity-popup-card", EntityPopupCard);
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
