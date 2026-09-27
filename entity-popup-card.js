/* Generated from src/. Edit the source files, then run npm run build. */
(() => {
  // src/native.js
  var ENTITY_ID = /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/;
  var ATTRIBUTE = /^[a-zA-Z][a-zA-Z0-9_]*$/;
  var unavailable = /* @__PURE__ */ new Set(["unknown", "unavailable"]);
  var isMap = (value) => value && typeof value === "object" && !Array.isArray(value);
  function validateNativeConfig(config) {
    if (!isMap(config?.card) || typeof config.card.type !== "string" || !config.card.type.trim()) {
      throw new Error("entity-popup-card: card needs a Lovelace type");
    }
    if (!isMap(config.popup?.card) || typeof config.popup.card.type !== "string" || !config.popup.card.type.trim()) {
      throw new Error("entity-popup-card: popup.card needs a Lovelace type");
    }
    if (config.entity !== void 0 && !ENTITY_ID.test(config.entity)) {
      throw new Error("entity-popup-card: entity must be an entity ID");
    }
    if (config.popup.title !== void 0 && (typeof config.popup.title !== "string" || !config.popup.title.trim())) {
      throw new Error("entity-popup-card: popup.title needs text");
    }
    if (config.popup.empty !== void 0 && (typeof config.popup.empty !== "string" || !config.popup.empty.trim())) {
      throw new Error("entity-popup-card: popup.empty needs text");
    }
    if (config.popup.width !== void 0 && (!Number.isInteger(config.popup.width) || config.popup.width < 320 || config.popup.width > 960)) {
      throw new Error("entity-popup-card: popup.width must be 320\u2013960 pixels");
    }
    if (Object.keys(config.popup).some(
      (key) => !["card", "source", "title", "width", "empty"].includes(key)
    )) {
      throw new Error("entity-popup-card: popup.card cannot be combined with legacy popup options");
    }
    const source = config.popup.source;
    if (source === void 0) return;
    if (!isMap(source) || !ATTRIBUTE.test(source.attribute || "entity_id")) {
      throw new Error("entity-popup-card: popup.source needs an attribute name");
    }
    if (!ENTITY_ID.test(source.entity || config.entity || "")) {
      throw new Error("entity-popup-card: popup.source needs an entity");
    }
    if (source.domain !== void 0 && (typeof source.domain !== "string" || !/^[a-z_]+$/.test(source.domain))) {
      throw new Error("entity-popup-card: popup.source.domain needs a domain");
    }
    if (source.state !== void 0 && (typeof source.state !== "string" || !source.state)) {
      throw new Error("entity-popup-card: popup.source.state needs a state");
    }
    if (source.recursive !== void 0 && typeof source.recursive !== "boolean") {
      throw new Error("entity-popup-card: popup.source.recursive must be true or false");
    }
    if (config.popup.card.type !== "entities" || config.popup.card.entities !== void 0) {
      throw new Error("entity-popup-card: popup.source supplies the entities of an entities card");
    }
  }
  function sourceRows(states, rootEntity, source, retained = /* @__PURE__ */ new Set()) {
    const root = states?.[source.entity || rootEntity];
    if (!root || unavailable.has(root.state)) return null;
    const values = root.attributes?.[source.attribute || "entity_id"];
    if (!Array.isArray(values)) return null;
    const seen = /* @__PURE__ */ new Set([source.entity || rootEntity]);
    const rows = [];
    const visit = (value) => {
      const id = typeof value === "string" ? value : value?.entity;
      if (!ENTITY_ID.test(id || "") || seen.has(id)) return;
      seen.add(id);
      const record = states?.[id];
      const children = source.recursive ? record?.attributes?.entity_id : void 0;
      if (Array.isArray(children)) {
        children.forEach(visit);
        return;
      }
      if (source.domain && !id.startsWith(`${source.domain}.`)) return;
      if (source.state && record?.state !== source.state && !retained.has(id)) return;
      if (isMap(value)) {
        const name = value.name && value.value ? `${value.name} \xB7 ${value.value}` : value.name || value.value;
        rows.push({
          entity: id,
          ...name ? { name } : {},
          ...value.icon ? { icon: value.icon } : {}
        });
      } else rows.push(id);
    };
    values.forEach(visit);
    return rows;
  }
  var NativeEntityPopupCard = class extends HTMLElement {
    static getStubConfig(_hass, entities = []) {
      const entity = entities.find((id) => ENTITY_ID.test(id)) || "sun.sun";
      return {
        entity,
        card: { type: "tile", entity },
        popup: { card: { type: "entities", entities: [entity], show_header_toggle: false } }
      };
    }
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; height: 100%; min-width: 0; }
        [hidden] { display: none !important; }
        .trigger, .trigger > * { display: block; height: 100%; min-width: 0; }
        :host([badge]) { display: inline-block; height: auto; }
        :host([badge]) .trigger, :host([badge]) .trigger > * { height: auto; }
      </style>
      <div class="trigger"></div>`;
      this._dialogRoot = document.createElement("div");
      this._dialogRoot.attachShadow({ mode: "open" });
      this._dialogRoot.shadowRoot.innerHTML = `
      <style>
        :host { display: contents; }
        ha-adaptive-dialog { --ha-dialog-width-md: var(--entity-popup-width, 480px); --dialog-content-padding: 0; }
        h2 { min-width: 0; margin: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font: inherit; }
        .content { max-height: min(75dvh, 720px); overflow: auto; padding: var(--ha-space-4, 16px); }
        .content > * { display: block; }
        .content.flat { padding-top: 0; }
        .popup-card.flat { --ha-card-background: transparent; --ha-card-border-width: 0; --ha-card-border-radius: 0; }
        .popup-card.flat:not(:empty) { margin-top: -8px; }
        .empty { margin: 0; padding: var(--ha-space-4, 16px); color: var(--secondary-text-color); }
        .empty[hidden] { display: none; }
      </style>
      <ha-adaptive-dialog aria-labelledby="entity-popup-title">
        <h2 slot="headerTitle" id="entity-popup-title"></h2>
        <div class="content"><div class="popup-card"></div><p class="empty" hidden>Nothing to show.</p></div>
      </ha-adaptive-dialog>`;
      this._trigger = this.shadowRoot.querySelector(".trigger");
      this._dialog = this._dialogRoot.shadowRoot.querySelector("ha-adaptive-dialog");
      this._title = this._dialogRoot.shadowRoot.querySelector("h2");
      this._popup = this._dialogRoot.shadowRoot.querySelector(".popup-card");
      this._content = this._dialogRoot.shadowRoot.querySelector(".content");
      this._empty = this._dialogRoot.shadowRoot.querySelector(".empty");
      this._revision = 0;
      this._retained = /* @__PURE__ */ new Set();
      this._onLocationChange = () => {
        if (this._dialogActive && window.location.pathname !== this._openPath)
          this._dialog.open = false;
      };
      const openFromTrigger = (event) => {
        if (!this._triggerCard || !event.composedPath().includes(this._triggerCard)) return;
        event.stopPropagation();
        this._open();
      };
      this.addEventListener("ll-custom", (event) => {
        if (event.detail?.action === "fire-dom-event") openFromTrigger(event);
      });
      this.addEventListener("hass-action", (event) => {
        if (event.detail?.action === "tap" && event.detail?.config?.tap_action?.action === "fire-dom-event")
          openFromTrigger(event);
      });
      this.addEventListener("hass-more-info", (event) => {
        const path = event.composedPath();
        if (this._triggerCard && path.includes(this._triggerCard)) {
          event.stopPropagation();
          this._open();
        }
      });
      this._dialog.addEventListener("hass-more-info", (event) => {
        if (this._popupCard && event.composedPath().includes(this._popupCard)) {
          event.stopPropagation();
          this._nextMoreInfo = event.detail?.entityId;
          this._dialog.open = false;
        }
      });
      this._dialog.addEventListener("closed", async (event) => {
        const source = event.composedPath()[0];
        if (source !== this._dialog && source?.parentNode !== this._dialog.shadowRoot) return;
        if (!this._dialogActive) return;
        await this._dialog.updateComplete;
        this._dialog.open = false;
        this._dialogActive = false;
        this._retained.clear();
        this._popupCard = null;
        this._popup.replaceChildren();
        window.removeEventListener("location-changed", this._onLocationChange);
        window.removeEventListener("popstate", this._onLocationChange);
        this._dialogRoot.remove();
        const opener = this._opener;
        this._opener = null;
        if (this._nextMoreInfo) {
          const entityId = this._nextMoreInfo;
          this._nextMoreInfo = null;
          this.dispatchEvent(
            new CustomEvent("hass-more-info", {
              bubbles: true,
              composed: true,
              detail: { entityId }
            })
          );
        } else if (this.isConnected && opener?.isConnected) opener.focus({ preventScroll: true });
      });
    }
    setConfig(config) {
      validateNativeConfig(config);
      const signature = JSON.stringify(config);
      if (signature === this._signature) return;
      this._signature = signature;
      this._config = config;
      this._revision++;
      if (this._dialog.open) this._dialog.open = false;
      this._triggerCard = null;
      this._popupCard = null;
      this._popupSignature = null;
      this._retained.clear();
      this._trigger.replaceChildren();
      this._popup.replaceChildren();
      this._popup.classList.toggle("flat", config.popup.card.type === "entities");
      this._content.classList.toggle("flat", config.popup.card.type === "entities");
      this._empty.textContent = config.popup.empty || "Nothing to show.";
      if (config.popup.width)
        this._dialog.style.setProperty("--entity-popup-width", `${config.popup.width}px`);
      else this._dialog.style.removeProperty("--entity-popup-width");
      if (this.isConnected) this._buildTrigger();
    }
    connectedCallback() {
      this._buildTrigger();
      if (this._dialog.open) this._renderPopup();
    }
    set hass(hass) {
      this._hass = hass;
      if (this._triggerCard) this._triggerCard.hass = hass;
      if (this._dialog.open) this._renderPopup();
    }
    set layout(layout) {
      this._layout = layout;
      if (this._triggerCard) this._triggerCard.layout = layout;
    }
    getCardSize() {
      return this._triggerCard?.getCardSize?.() ?? 1;
    }
    getGridOptions() {
      return this._triggerCard?.getGridOptions?.() ?? { columns: 6, rows: 1 };
    }
    async _buildTrigger() {
      if (!this.isConnected || !this._config || this._triggerCard) return;
      const revision = ++this._revision;
      try {
        const helpers = await window.loadCardHelpers();
        if (revision !== this._revision || !this.isConnected) return;
        const config = this._config.card;
        const card = helpers.createCardElement({
          ...config,
          ...config.entity || !this._config.entity ? {} : { entity: this._config.entity },
          tap_action: {
            action: config.type.startsWith("custom:mushroom-") ? "fire-dom-event" : "more-info"
          }
        });
        card.layout = this._layout;
        if (this._hass) card.hass = this._hass;
        this._triggerCard = card;
        this._trigger.replaceChildren(card);
      } catch (error) {
        if (revision !== this._revision) return;
        this._trigger.textContent = "Card unavailable";
        console.error("entity-popup-card: unable to create trigger", error);
      }
    }
    async _open(opener) {
      if (!this.isConnected) return;
      if (opener === void 0) {
        let active = document.activeElement;
        while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
        opener = active && active !== document.body ? active : null;
      }
      if (this._dialogActive) return;
      this._dialogActive = true;
      const revision = this._revision;
      const openPath = window.location.pathname;
      document.body.append(this._dialogRoot);
      await customElements.whenDefined("ha-adaptive-dialog");
      await this._dialog.updateComplete;
      if (revision !== this._revision || window.location.pathname !== openPath) {
        this._dialogActive = false;
        this._dialogRoot.remove();
        return;
      }
      this._opener = opener;
      this._openPath = openPath;
      window.addEventListener("location-changed", this._onLocationChange);
      window.addEventListener("popstate", this._onLocationChange);
      this._retained.clear();
      this._title.textContent = this._config.popup.title || this._hass?.states?.[this._config.entity]?.attributes?.friendly_name || "Details";
      this._dialog.open = true;
      this._renderPopup();
    }
    async _renderPopup() {
      const source = this._config.popup.source;
      const rows = source ? sourceRows(this._hass?.states, this._config.entity, source, this._retained) : null;
      if (rows && source.state)
        rows.forEach((row) => this._retained.add(typeof row === "string" ? row : row.entity));
      this._empty.textContent = rows === null && source ? "Source unavailable." : this._config.popup.empty || "Nothing to show.";
      this._empty.hidden = !source || rows !== null && rows.length > 0;
      if (source && (!rows || rows.length === 0)) {
        this._revision++;
        this._popup.replaceChildren();
        this._popupCard = null;
        this._popupSignature = null;
        return;
      }
      const config = rows ? { ...this._config.popup.card, entities: rows } : this._config.popup.card;
      const signature = JSON.stringify(config);
      if (signature === this._popupSignature && this._popupCard) {
        this._popupCard.hass = this._hass;
        return;
      }
      const revision = ++this._revision;
      this._popupSignature = signature;
      try {
        const helpers = await window.loadCardHelpers();
        if (revision !== this._revision || !this._dialog.open) return;
        const card = helpers.createCardElement(config);
        if (this._hass) card.hass = this._hass;
        this._popupCard = card;
        this._popup.replaceChildren(card);
      } catch (error) {
        if (revision !== this._revision) return;
        this._popupSignature = null;
        this._popup.textContent = "Details unavailable";
        console.error("entity-popup-card: unable to create popup card", error);
      }
    }
  };

  // src/native-badge.js
  var NativeEntityPopupBadge = class extends NativeEntityPopupCard {
    connectedCallback() {
      this.setAttribute("badge", "");
      super.connectedCallback();
    }
    setConfig(config) {
      if (!config?.badge || typeof config.badge !== "object" || Array.isArray(config.badge)) {
        throw new Error("entity-popup-badge: badge needs a Mushroom badge configuration");
      }
      this._badgeConfig = config.badge;
      super.setConfig({ ...config, card: { type: "custom:mushroom-template-badge" } });
    }
    async _buildTrigger() {
      if (!this.isConnected || !this._config || this._triggerCard) return;
      const revision = ++this._revision;
      try {
        await customElements.whenDefined("mushroom-template-badge");
        if (revision !== this._revision || !this.isConnected) return;
        const badge = document.createElement("mushroom-template-badge");
        badge.setConfig({
          ...this._badgeConfig,
          entity: this._badgeConfig.entity || this._config.entity,
          tap_action: { action: "fire-dom-event" }
        });
        if (this._hass) badge.hass = this._hass;
        this._triggerCard = badge;
        this._trigger.replaceChildren(badge);
      } catch (error) {
        if (revision !== this._revision) return;
        this._trigger.textContent = "Badge unavailable";
        console.error("entity-popup-badge: unable to create badge", error);
      }
    }
  };

  // src/index.js
  if (!customElements.get("entity-popup-card"))
    customElements.define("entity-popup-card", NativeEntityPopupCard);
  if (!customElements.get("entity-popup-badge"))
    customElements.define("entity-popup-badge", NativeEntityPopupBadge);
  window.customCards = window.customCards || [];
  if (!window.customCards.some((card) => card.type === "entity-popup-card")) {
    window.customCards.push({
      type: "entity-popup-card",
      name: "Entity Popup Card",
      description: "Open a Lovelace card in a native popup.",
      documentationURL: "https://github.com/alphasixtyfive/entity-popup-card"
    });
  }
  window.customBadges = window.customBadges || [];
  if (!window.customBadges.some((badge) => badge.type === "entity-popup-badge")) {
    window.customBadges.push({
      type: "entity-popup-badge",
      name: "Entity Popup Badge",
      description: "Open a Lovelace card from a Mushroom badge."
    });
  }
})();
