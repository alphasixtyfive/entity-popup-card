import { EntityPopupCard } from "./card.js";

// Keep the popup behavior shared with the card; only its visible trigger differs.
export class EntityPopupBadge extends EntityPopupCard {
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
}
