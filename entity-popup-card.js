/* A compact Mushroom tile with a configurable, live detail popup. */
(() => {
  "use strict";

  const ENTITY = /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/;
  const PATH = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)*$/;
  const SOURCES = new Set(["members", "entities", "match", "values"]);
  const MODES = new Set(["view", "controls"]);
  const CONTROL_DOMAINS = new Set(["light", "switch", "fan", "input_boolean"]);
  const badKeys = new Set(["__proto__", "prototype", "constructor"]);
  const readable = (value) =>
    String(value ?? "")
      .replaceAll("_", " ")
      .replaceAll("-", " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  const sortName = (a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });

  function atPath(value, path) {
    if (!PATH.test(path || "")) return undefined;
    for (const key of path.split(".")) {
      if (
        badKeys.has(key) ||
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
    if (Array.isArray(value))
      return value.filter((id) => typeof id === "string" && ENTITY.test(id));
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
        !["members", "values"].includes(section.source) ||
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
      const stateKnown = item.state === active || item.state === inactive;
      if (item.state === active) result.activeCount++;
      if (!stateKnown && section.source === "members") result.unavailable.push(item);
      if (section.show !== "active" || item.state === active) result.items.push(item);
    };

    if (section.source === "members") {
      const members = ids(atPath(root?.attributes, section.attribute || "entity_id"));
      result.membershipKnown = members !== null;
      const visited = new Set([rootEntity]);
      const ancestors = new Set([rootEntity]);
      const visit = (id) => {
        if (ancestors.has(id)) {
          const cycle = entityItem(states, id, section);
          cycle.state = "unavailable";
          add(cycle);
          return;
        }
        if (visited.has(id)) return;
        visited.add(id);
        if (section.domain && !id.startsWith(`${section.domain}.`) && !section.recursive) return;
        const record = states?.[id];
        const children = section.recursive ? ids(record?.attributes?.entity_id) : null;
        if (children !== null) {
          ancestors.add(id);
          children.forEach(visit);
          ancestors.delete(id);
          return;
        }
        if (section.domain && !id.startsWith(`${section.domain}.`)) return;
        if (section.mode === "controls" && !CONTROL_DOMAINS.has(id.split(".")[0])) return;
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
      const values = result.sourceAvailable
        ? atPath(root?.attributes, section.attribute)
        : undefined;
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
    }
    if (["members", "match"].includes(section.source)) {
      result.items.sort(sortName);
      result.allItems.sort(sortName);
      result.unavailable.sort(sortName);
    }
    return result;
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { atPath, collectSection };
  if (typeof HTMLElement === "undefined") return;

  class EntityPopupCard extends HTMLElement {
    static getStubConfig(_hass, entities = []) {
      const entity = entities.find((id) => ENTITY.test(id)) || "sun.sun";
      return {
        entity,
        card: { type: "tile", entity },
        popup: {
          sections: [
            { source: "entities", entities: [entity], show_state: true, row_action: "more-info" },
          ],
        },
      };
    }

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._revision = 0;
      this._rows = new Map();
      this._retained = new Map();
      this._operations = new Map();
      this._errors = new Map();
      this.shadowRoot.innerHTML = `
        <style>
          :host { display:block; min-width:0; height:100%; font-family:var(--ha-font-family-body,inherit); }
          .tile, .tile > * { display:block; height:100%; min-width:0; }
          :host([compact]) { height:auto; }
          :host([compact]) .tile, :host([compact]) .tile > * { height:auto; }
          dialog { box-sizing:border-box; width:min(480px,calc(100vw - 24px)); max-height:min(80dvh,720px); padding:0; border:1px solid var(--divider-color,#555); border-radius:var(--ha-border-radius-3xl,24px); color:var(--primary-text-color,#212121); background:var(--ha-color-surface-default,var(--ha-card-background,var(--card-background-color,#fff))); box-shadow:var(--ha-box-shadow-l,0 12px 40px #0006); overflow:auto; }
          dialog::backdrop { background:#0007; }
          .header { position:sticky; top:0; z-index:1; display:flex; align-items:center; gap:var(--ha-space-3,12px); padding-block:var(--ha-space-3,12px); padding-inline:var(--ha-space-3,12px) var(--ha-space-5,20px); background:inherit; }
          h2 { margin:0; flex:1; min-width:0; font-size:var(--ha-font-size-xl,20px); line-height:28px; font-weight:var(--ha-font-weight-medium,600); }
          .close { flex:none; display:grid; place-items:center; width:44px; height:44px; border:0; border-radius:50%; background:transparent; color:var(--primary-text-color); cursor:pointer; }
          .close:hover, .row-button:hover, .switch:hover { background:var(--secondary-background-color,#8882); }
          button:focus-visible { outline:2px solid var(--primary-color); outline-offset:1px; }
          .body { padding-block:var(--ha-space-4,16px) var(--ha-space-6,24px); padding-inline:var(--ha-space-6,24px); }
          .status, .empty, .unavailable { margin:0; font-size:14px; line-height:21px; color:var(--secondary-text-color); overflow-wrap:anywhere; }
          .status { margin-block-end:var(--ha-space-3,12px); }
          .section + .section { margin-block-start:var(--ha-space-5,20px); }
          h3 { margin:12px 0 4px; font-size:var(--ha-font-size-m,14px); line-height:20px; font-weight:var(--ha-font-weight-medium,600); color:var(--secondary-text-color); }
          ul { list-style:none; margin:4px 0 0; padding:0; }
          li { display:flex; align-items:center; gap:12px; min-height:56px; padding:4px 0; }
          li + li { border-top:1px solid var(--divider-color,#8883); }
          li ha-icon { flex:none; --mdc-icon-size:22px; color:var(--primary-color); }
          .copy { flex:1; min-width:0; }
          .name { display:block; font-size:var(--ha-font-size-m,15px); line-height:22px; overflow-wrap:anywhere; }
          .detail { display:block; font-size:var(--ha-font-size-s,12px); line-height:18px; color:var(--secondary-text-color); overflow-wrap:anywhere; }
          .row-button { flex:1; display:flex; align-items:center; gap:12px; min-height:48px; padding:0; border:0; border-radius:6px; background:transparent; color:inherit; font:inherit; text-align:left; cursor:pointer; }
          .row-button ha-icon:last-child { color:var(--secondary-text-color); --mdc-icon-size:18px; }
          .switch { flex:none; display:grid; place-items:center; width:48px; height:44px; padding:0; border:0; border-radius:8px; background:transparent; cursor:pointer; }
          .switch:disabled { cursor:default; opacity:.45; }
          .switch[aria-busy="true"] { cursor:wait; }
          .track { display:block; box-sizing:border-box; width:36px; height:22px; padding:3px; border-radius:12px; background:var(--disabled-color,#777); transition:background 120ms; }
          .thumb { display:block; width:16px; height:16px; margin-inline-start:0; border-radius:50%; background:var(--card-background-color,#fff); transition:margin-inline-start 120ms; }
          .switch[aria-checked="true"] .track { background:var(--state-light-active-color,var(--primary-color,#03a9f4)); }
          .switch[aria-checked="true"] .thumb { margin-inline-start:14px; }
          .empty { padding:12px 0 4px; }
          .unavailable { padding-top:8px; }
          .error { margin:12px 0 0; color:var(--error-color,#db4437); font-size:13px; line-height:20px; white-space:pre-line; overflow-wrap:anywhere; }
          li[data-state="off"] > ha-icon,
          li[data-state="off"] .row-button > ha-icon:first-child,
          li[data-state="unavailable"] > ha-icon,
          li[data-state="unavailable"] .row-button > ha-icon:first-child,
          li[data-state="unknown"] > ha-icon,
          li[data-state="unknown"] .row-button > ha-icon:first-child { color:var(--secondary-text-color); }
          li[data-state="on"] > ha-icon,
          li[data-state="on"] .row-button > ha-icon:first-child { color:var(--state-light-active-color,var(--primary-color)); }
          [hidden] { display:none !important; }
          @media (max-width:870px), (max-height:500px) {
            dialog { inset:auto 0 0; width:100%; max-width:none; max-height:calc(100dvh - max(var(--safe-area-inset-top,0px),48px)); margin:0; border-radius:var(--ha-border-radius-3xl,24px) var(--ha-border-radius-3xl,24px) 0 0; border-inline:0; border-bottom:0; }
            .body { padding-bottom:calc(var(--ha-space-6,24px) + var(--safe-area-inset-bottom,0px)); }
          }
          @media (prefers-reduced-motion:reduce) { .track,.thumb { transition:none; } }
        </style>
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
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          this._dialog.close();
      });
      this._dialog.addEventListener("close", () => {
        this._retained.clear();
        this._rows.clear();
        this._sections.replaceChildren();
        this._errors.clear();
        if (this.isConnected && this._opener?.isConnected)
          this._opener.focus({ preventScroll: true });
        this._opener = null;
      });
      this.addEventListener("hass-action", (event) => {
        const detail = event.detail;
        if (
          detail?.action !== "tap" ||
          detail.config?.tap_action?.action !== "fire-dom-event" ||
          !event.composedPath().includes(this._card)
        )
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
      if (
        !ENTITY.test(config?.entity || "") ||
        !config.popup ||
        !Array.isArray(config.popup.sections) ||
        !config.popup.sections.length
      ) {
        throw new Error("entity-popup-card requires an entity and at least one popup section.");
      }
      if (
        config.card &&
        (typeof config.card !== "object" ||
          Array.isArray(config.card) ||
          typeof config.card.type !== "string")
      ) {
        throw new Error("The card option must contain a Lovelace card type.");
      }
      if (config.popup.status_attribute && !PATH.test(config.popup.status_attribute))
        throw new Error("Invalid popup status attribute.");
      if (
        config.popup.status_attributes &&
        (!Array.isArray(config.popup.status_attributes) ||
          config.popup.status_attributes.some((path) => !PATH.test(path)))
      ) {
        throw new Error("Invalid popup status attributes.");
      }
      for (const section of config.popup.sections) {
        if (
          !SOURCES.has(section.source) ||
          !MODES.has(section.mode || "view") ||
          !["active", "all", undefined].includes(section.show)
        )
          throw new Error("Invalid popup section.");
        if (section.row_action && !["more-info", "none"].includes(section.row_action))
          throw new Error("Invalid row action.");
        if (
          ["members", "values"].includes(section.source) &&
          !PATH.test(section.attribute || "entity_id")
        )
          throw new Error("Invalid member attribute.");
        if (
          section.source === "entities" &&
          (!Array.isArray(section.entities) ||
            section.entities.some(
              (entry) => !ENTITY.test((typeof entry === "string" ? entry : entry?.entity) || ""),
            ))
        )
          throw new Error("Invalid entity list.");
        if (
          section.source === "match" &&
          (typeof section.prefix !== "string" ||
            !section.prefix.includes(".") ||
            typeof (section.suffix || "") !== "string")
        )
          throw new Error("Invalid entity match.");
        if (
          section.mode === "controls" &&
          (!["members", "entities"].includes(section.source) ||
            (section.domain && !CONTROL_DOMAINS.has(section.domain)) ||
            (section.active_state && section.active_state !== "on") ||
            (section.inactive_state && section.inactive_state !== "off"))
        ) {
          throw new Error("Controls require on/off members of a supported domain.");
        }
        if (
          section.mode === "controls" &&
          section.source === "entities" &&
          section.entities.some(
            (entry) =>
              !CONTROL_DOMAINS.has(
                (typeof entry === "string" ? entry : entry.entity).split(".")[0],
              ) ||
              (section.domain &&
                !(typeof entry === "string" ? entry : entry.entity).startsWith(
                  `${section.domain}.`,
                )),
          )
        ) {
          throw new Error("Controls require entities in a supported domain.");
        }
        if (
          section.details &&
          (!Array.isArray(section.details) ||
            section.details.some((detail) => !PATH.test(detail.attribute || detail.field || "")))
        )
          throw new Error("Invalid row details.");
      }
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
          tap_action: { action: "fire-dom-event" },
          hold_action: { action: "none" },
          double_tap_action: { action: "none" },
          icon_hold_action: { action: "none" },
          icon_double_tap_action: { action: "none" },
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
      this._opener =
        active && active !== document.body
          ? active
          : this._card?.shadowRoot?.querySelector('[role="button"][aria-labelledby="info"]');
      this._retained.clear();
      this._errors.clear();
      this._renderDialog();
      this._dialog.showModal();
      this._close.focus({ preventScroll: true });
    }

    _sectionNode(index, section) {
      let node = this._sections.children[index];
      if (node) return node;
      node = document.createElement("div");
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
      node._parts = { list, empty, missing };
      this._sections.append(node);
      return node;
    }

    _detail(item, section) {
      const parts = [];
      if (section.show_state && item.entity) {
        const state = this._hass?.states?.[item.entity];
        const label =
          section.state_labels?.[item.state] ||
          (state && this._hass?.formatEntityState?.(state)) ||
          readable(item.state);
        parts.push(label);
      }
      for (const detail of section.details || []) {
        const value = detail.attribute
          ? atPath(item.attributes, detail.attribute)
          : item[detail.field];
        if (value == null || value === "" || Array.isArray(value) || typeof value === "object")
          continue;
        let display = String(value);
        if (detail.format === "datetime") {
          const date = new Date(value);
          if (Number.isNaN(date.getTime())) continue;
          display = date.toLocaleString(undefined, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
        }
        parts.push(`${detail.label ? `${detail.label} ` : ""}${display}${detail.unit || ""}`);
      }
      return parts.join(" · ");
    }

    _renderDialog() {
      const config = this._config.popup;
      const source = this._hass?.states?.[this._config.entity];
      for (const [key, operation] of this._operations) {
        const entity = key.slice(key.indexOf(":") + 1);
        if (operation.settled && this._hass?.states?.[entity]?.state === operation.target) {
          clearTimeout(operation.timer);
          this._operations.delete(key);
        }
      }
      for (const [key, error] of this._errors)
        if (this._hass?.states?.[error.entity]?.state === error.target) this._errors.delete(key);
      this._title.textContent =
        config.title || this._config.dialog_title || source?.attributes?.friendly_name || "Details";
      const snapshots = config.sections.map((section) =>
        collectSection(this._hass?.states, this._config.entity, section),
      );
      if (config.status_attribute || config.status_attributes) {
        const paths = config.status_attributes || [config.status_attribute];
        const values =
          source && !["unknown", "unavailable"].includes(source.state)
            ? paths
                .map((path) => atPath(source.attributes, path))
                .filter((value) => ["string", "number"].includes(typeof value) && value !== "")
            : [];
        this._status.textContent = values.length
          ? values.map(readable).join(" · ")
          : "Status unavailable";
      } else if (config.status_text) {
        this._status.textContent = config.status_text;
      } else {
        const first = snapshots[0];
        const section = config.sections[0];
        const count = first.activeCount;
        const noun = count === 1 ? section.singular || "item" : section.plural || "items";
        this._status.textContent =
          section.source !== "members"
            ? ""
            : !first.membershipKnown
              ? "Items unavailable"
              : `${count} ${noun} ${section.active_label || "active"}${first.sourceAvailable ? "" : " · Source unavailable"}`;
      }
      this._status.hidden = !this._status.textContent;
      if (this._status.hidden) this._dialog.removeAttribute("aria-describedby");
      else this._dialog.setAttribute("aria-describedby", "entity-popup-status");

      const keepRows = new Set();
      for (const [index, section] of config.sections.entries()) {
        const snapshot = snapshots[index];
        const { list, empty, missing } = this._sectionNode(index, section)._parts;
        const current = new Map(
          snapshot.allItems.filter((item) => item.entity).map((item) => [item.entity, item]),
        );
        let items = snapshot.items;
        if (section.mode === "controls" && section.show === "active") {
          for (const item of snapshot.items)
            if (item.state === (section.active_state || "on"))
              this._retained.set(`${index}:${item.entity}`, item);
          for (const [key, item] of this._retained) {
            if (!key.startsWith(`${index}:`)) continue;
            if (snapshot.membershipKnown && !snapshot.memberIds.has(item.entity))
              this._retained.delete(key);
            else
              this._retained.set(
                key,
                current.get(item.entity) || entityItem(this._hass?.states, item.entity, section),
              );
          }
          items = [...this._retained]
            .filter(([key]) => key.startsWith(`${index}:`))
            .map(([, item]) => item)
            .sort(sortName);
        }
        for (const [rowIndex, item] of items.entries()) {
          const key = `${index}:${item.key}`;
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
            const detail = document.createElement("span");
            detail.className = "detail";
            copy.append(name, detail);
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
              control.className = "switch";
              control.setAttribute("role", "switch");
              const track = document.createElement("span");
              track.className = "track";
              track.setAttribute("aria-hidden", "true");
              const thumb = document.createElement("span");
              thumb.className = "thumb";
              track.append(thumb);
              control.append(track);
              control.addEventListener("click", () => this._change(index, item.entity));
              row.append(control);
            } else control = rowButton;
            parts = { row, icon, name, detail, control, rowButton };
            this._rows.set(key, parts);
          }
          parts.icon.icon =
            item.icon ||
            (item.state === (section.active_state || "on")
              ? section.active_icon
              : section.inactive_icon) ||
            section.icon ||
            "mdi:circle-outline";
          parts.icon.style.color = item.color || "";
          parts.row.setAttribute("data-state", item.state);
          parts.name.textContent = item.name;
          const detail = this._detail(item, section);
          parts.detail.textContent = detail;
          parts.detail.hidden = !detail;
          if (section.mode === "controls") {
            const busy = this._operations.has(key);
            parts.control.setAttribute("aria-label", item.name);
            parts.control.setAttribute(
              "aria-checked",
              String(item.state === (section.active_state || "on")),
            );
            parts.control.setAttribute("aria-busy", String(busy));
            parts.control.disabled =
              ![section.active_state || "on", section.inactive_state || "off"].includes(
                item.state,
              ) ||
              busy ||
              !snapshot.membershipKnown ||
              !snapshot.memberIds.has(item.entity);
            parts.control.title = busy
              ? "Updating…"
              : item.state === (section.active_state || "on")
                ? "Turn off"
                : "Turn on";
            if (parts.rowButton)
              parts.rowButton.setAttribute("aria-label", `${item.name}. More information`);
          } else if (section.row_action === "more-info" && parts.control)
            parts.control.setAttribute("aria-label", `${item.name}. More information`);
          if (list.children[rowIndex] !== parts.row)
            list.insertBefore(parts.row, list.children[rowIndex] || null);
        }
        empty.hidden = items.length > 0;
        empty.textContent = !snapshot.membershipKnown
          ? "Items cannot be listed right now."
          : section.empty_text || "Nothing to show.";
        const unavailable = snapshot.unavailable.filter(
          (item) => !items.some((row) => row.key === item.key),
        );
        missing.hidden = unavailable.length === 0;
        missing.textContent = unavailable.length
          ? `Unavailable: ${unavailable.map((item) => item.name).join(", ")}`
          : "";
      }
      for (const [key, parts] of this._rows)
        if (!keepRows.has(key)) {
          parts.row.remove();
          this._rows.delete(key);
        }
      this._error.hidden = this._errors.size === 0;
      this._error.textContent = [...this._errors.values()]
        .map((error) => `${error.name}: ${error.message}`)
        .join("\n");
    }

    _moreInfo(entityId) {
      if (!ENTITY.test(entityId || "")) return;
      this._dialog.close();
      this.dispatchEvent(
        new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } }),
      );
    }

    async _change(index, entity) {
      const section = this._config.popup.sections[index];
      const key = `${index}:${entity}`;
      if (
        !this.isConnected ||
        !this._dialog.open ||
        section.mode !== "controls" ||
        this._operations.has(key)
      )
        return;
      const snapshot = collectSection(this._hass?.states, this._config.entity, {
        ...section,
        show: "all",
      });
      if (!snapshot.membershipKnown || !snapshot.memberIds.has(entity)) return;
      const state = this._hass?.states?.[entity]?.state;
      if (
        ![section.active_state || "on", section.inactive_state || "off"].includes(state) ||
        typeof this._hass?.callService !== "function"
      )
        return;
      const target =
        state === (section.active_state || "on")
          ? section.inactive_state || "off"
          : section.active_state || "on";
      const operation = { target, settled: false, timer: null };
      this._operations.set(key, operation);
      this._errors.delete(key);
      this._renderDialog();
      try {
        await this._hass.callService(
          entity.split(".")[0],
          target === (section.active_state || "on") ? "turn_on" : "turn_off",
          { entity_id: entity },
        );
        if (this._operations.get(key) !== operation) return;
        operation.settled = true;
        operation.timer = setTimeout(
          () => this._finishOperation(key, operation, entity, "No update received. Try again."),
          10000,
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
          target: operation.target,
          name: this._hass?.states?.[entity]?.attributes?.friendly_name || entity,
          message,
        });
      if (this._dialog.open) this._renderDialog();
    }

    _clearOperations() {
      for (const operation of this._operations.values()) clearTimeout(operation.timer);
      this._operations.clear();
    }
  }

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
        if (
          !entityId?.startsWith("light.") ||
          !Array.isArray(hass?.states?.[entityId]?.attributes?.entity_id)
        )
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
                  domain: "light",
                  mode: "controls",
                  show: "active",
                  show_state: true,
                  row_action: "more-info",
                },
              ],
            },
          },
        };
      },
    });
  }
})();
