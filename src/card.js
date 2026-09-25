import { ENTITY, readable, sortName, atPath, entityItem, collectSection } from "./data.js";
import { CONTROL_TYPES, actionFor, controlFor, isActive } from "./controls.js";
import { validateConfig } from "./config.js";
import POPUP_STYLES from "./styles.css";

const STATE_UPDATE_TIMEOUT_MS = 15_000;

export class EntityPopupCard extends HTMLElement {
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
    this._sectionNodes = new Map();
    this._retained = new Map();
    this._operations = new Map();
    this._errors = new Map();
    this.shadowRoot.innerHTML = `
      <style>${POPUP_STYLES}</style>
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
      this._sectionNodes.clear();
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
      // Mushroom uses this event for fire-dom-event; built-in cards use hass-action.
      if (event.detail?.action !== "fire-dom-event" || !event.composedPath().includes(this._card))
        return;
      event.stopPropagation();
      this._openDialog();
    });
  }

  setConfig(config) {
    validateConfig(config);
    this._config = config;
    if (config.popup.width === undefined) this._dialog.style.removeProperty("--entity-popup-width");
    else this._dialog.style.setProperty("--entity-popup-width", `${config.popup.width}px`);
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
    // Preserve keyboard focus even when the tile keeps it inside a shadow root.
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
      if (
        operation.settled &&
        operation.confirmedStates.includes(this._hass?.states?.[entity]?.state)
      ) {
        clearTimeout(operation.timer);
        this._operations.delete(key);
      }
    }
    for (const [key, error] of this._errors)
      if (error.confirmedStates.includes(this._hass?.states?.[error.entity]?.state))
        this._errors.delete(key);
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
      const control =
        section.mode === "controls" && section.domain ? CONTROL_TYPES.get(section.domain) : null;
      this._status.textContent =
        section.source !== "members"
          ? ""
          : !first.membershipKnown
            ? "Items unavailable"
            : `${count} ${noun} ${section.active_label || control?.activeLabel || "active"}${first.sourceAvailable ? "" : " · Source unavailable"}`;
    }
    this._status.hidden = !this._status.textContent;
    if (this._status.hidden) this._dialog.removeAttribute("aria-describedby");
    else this._dialog.setAttribute("aria-describedby", "entity-popup-status");

    const keepRows = new Set();
    for (const [index, section] of config.sections.entries()) {
      const snapshot = snapshots[index];
      const { list, empty, missing } = this._sectionNode(index, section);
      const current = new Map(
        snapshot.allItems.filter((item) => item.entity).map((item) => [item.entity, item]),
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
              current.get(item.entity) || entityItem(this._hass?.states, item.entity, section),
            );
          }
        }
        items = [...this._retained]
          .filter(([key]) => key.startsWith(sectionKey))
          .map(([, item]) => item);
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
        const itemActive = domainControl
          ? isActive(domainControl, item.state)
          : item.state === (section.active_state || "on");
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
          parts = { row, icon, name, detail, control, rowButton };
          this._rows.set(key, parts);
        }
        parts.icon.icon =
          item.icon ||
          (itemActive ? section.active_icon : section.inactive_icon) ||
          section.icon ||
          "mdi:circle-outline";
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
            domainControl?.presentation === "button"
              ? `${action?.label || "Control"} ${item.name}`
              : item.name,
          );
          if (domainControl?.presentation === "button") {
            parts.control.textContent = action?.label || "Moving";
          } else {
            parts.control.setAttribute("aria-checked", String(itemActive));
          }
          parts.control.setAttribute("aria-busy", String(busy));
          parts.control.disabled =
            !action || busy || !snapshot.membershipKnown || !snapshot.memberIds.has(item.entity);
          parts.control.title = busy ? "Updating…" : action?.label || "Unavailable";
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
      const visibleKeys = new Set(items.map((item) => item.key));
      const unavailable = snapshot.unavailable.filter((item) => !visibleKeys.has(item.key));
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
        STATE_UPDATE_TIMEOUT_MS,
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
        message,
      });
    if (this._dialog.open) this._renderDialog();
  }

  _clearOperations() {
    for (const operation of this._operations.values()) clearTimeout(operation.timer);
    this._operations.clear();
  }
}
