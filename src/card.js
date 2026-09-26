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
    this._actionPending = new Map();
    this._actionButtons = [];
    this.shadowRoot.innerHTML = `
      <style>${POPUP_STYLES}</style>
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
    if (
      section.source !== "members" &&
      !(section.source === "entities" && section.mode === "controls")
    )
      return "";
    if (!snapshot.membershipKnown) return "Items unavailable";
    const count = snapshot.activeCount;
    const noun = count === 1 ? section.singular || "item" : section.plural || "items";
    const control =
      section.mode === "controls" && section.domain ? CONTROL_TYPES.get(section.domain) : null;
    const unavailable = snapshot.allItems.filter((item) =>
      ["unknown", "unavailable"].includes(item.state),
    ).length;
    return `${count} ${noun} ${section.active_label || control?.activeLabel || "active"}${unavailable ? ` · ${unavailable} unavailable` : ""}${snapshot.sourceAvailable ? "" : " · Source unavailable"}`;
  }

  _renderSummaryTile() {
    if (!this._summaryParts || !this._config?.summary_tile) return;
    const { button, icon, name, state } = this._summaryParts;
    const section = this._config.popup.sections[0];
    const snapshot = collectSection(this._hass?.states, this._config.entity, section);
    name.textContent = this._config.summary_tile.name;
    state.textContent = this._sectionSummary(snapshot, section) || `${snapshot.items.length} items`;
    icon.icon =
      this._config.summary_tile.icon ||
      this._hass?.states?.[this._config.entity]?.attributes?.icon ||
      "mdi:format-list-bulleted";
    button.dataset.active = String(snapshot.activeCount > 0);
    button.setAttribute("aria-label", `${name.textContent}, ${state.textContent}`);
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
      this._status.textContent = this._sectionSummary(snapshots[0], config.sections[0]);
    }
    this._status.hidden = !this._status.textContent;
    if (this._status.hidden) this._dialog.removeAttribute("aria-describedby");
    else this._dialog.setAttribute("aria-describedby", "entity-popup-status");

    const keepRows = new Set();
    for (const [index, section] of config.sections.entries()) {
      const snapshot = snapshots[index];
      const { list, empty, missing, bulk } = this._sectionNode(index, section);
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
            !action ||
            busy ||
            this._actionPending.size > 0 ||
            !snapshot.membershipKnown ||
            !snapshot.memberIds.has(item.entity);
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
      if (section.bulk_label) {
        const actionable = snapshot.allItems.some((item) => {
          const control = controlFor(item.entity);
          return control && isActive(control, item.state) && actionFor(control, item.state);
        });
        bulk.disabled =
          !snapshot.membershipKnown ||
          !actionable ||
          this._operations.size > 0 ||
          this._actionPending.size > 0;
      }
    }
    for (const [key, parts] of this._rows)
      if (!keepRows.has(key)) {
        parts.row.remove();
        this._rows.delete(key);
      }
    this._renderActions();
    this._error.hidden = this._errors.size === 0;
    this._error.textContent = [...this._errors.values()]
      .map((error) => `${error.name}: ${error.message}`)
      .join("\n");
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
      parts.button.disabled =
        !available || this._actionPending.size > 0 || this._operations.size > 0;
      parts.button.setAttribute(
        "aria-label",
        available ? parts.name.textContent : `${parts.name.textContent} unavailable`,
      );
      parts.button.setAttribute("aria-busy", String(this._actionPending.has(index)));
    }
  }

  async _runAction(index) {
    const action = this._config.popup.actions?.[index];
    const state = this._hass?.states?.[action?.entity]?.state;
    if (
      !this.isConnected ||
      !this._dialog.open ||
      !action ||
      !state ||
      ["unknown", "unavailable"].includes(state) ||
      this._actionPending.size ||
      this._operations.size ||
      typeof this._hass?.callService !== "function"
    )
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
          message: "Couldn't run the action. Try again.",
        });
    } finally {
      if (this._actionPending.get(index) === pending) this._actionPending.delete(index);
      if (this._dialog.open) this._renderDialog();
    }
  }

  async _bulkChange(index) {
    const section = this._config.popup.sections[index];
    if (
      !this.isConnected ||
      !this._dialog.open ||
      section?.mode !== "controls" ||
      !section.bulk_label ||
      this._operations.size ||
      this._actionPending.size ||
      typeof this._hass?.callService !== "function"
    )
      return;
    const snapshot = collectSection(this._hass?.states, this._config.entity, section);
    if (!snapshot.membershipKnown) return;
    const groups = new Map();
    for (const item of snapshot.allItems) {
      const control = controlFor(item.entity);
      if (!control || !isActive(control, item.state)) continue;
      const action = actionFor(control, item.state);
      if (!action) continue;
      const domain = item.entity.split(".")[0];
      const groupKey = `${domain}.${action.service}`;
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups
        .get(groupKey)
        .push({ key: `${index}:${item.entity}`, entity: item.entity, domain, action });
    }
    await Promise.all([...groups.values()].map((changes) => this._sendControlGroup(changes)));
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
      this._operations.has(key) ||
      this._actionPending.size > 0
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
        entity_id: entityIds.length === 1 ? entityIds[0] : entityIds,
      });
      for (const { key, entity, operation } of pending) {
        if (this._operations.get(key) !== operation) continue;
        if (operation.confirmedStates.includes(this._hass?.states?.[entity]?.state)) {
          this._operations.delete(key);
        } else {
          operation.settled = true;
          operation.timer = setTimeout(
            () => this._finishOperation(key, operation, entity, "No update received. Try again."),
            STATE_UPDATE_TIMEOUT_MS,
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
          false,
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
        message,
      });
    if (render && this._dialog.open) this._renderDialog();
  }

  _settleOperations() {
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
      if (error.confirmedStates?.includes(this._hass?.states?.[error.entity]?.state))
        this._errors.delete(key);
  }

  _clearOperations() {
    for (const operation of this._operations.values()) clearTimeout(operation.timer);
    this._operations.clear();
  }
}
