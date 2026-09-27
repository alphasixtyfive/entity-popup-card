import { NativeEntityPopupCard } from "./native.js";

export class NativeEntityPopupBadge extends NativeEntityPopupCard {
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
        tap_action: { action: "fire-dom-event" },
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
}
