import { EntityPopupCard } from "./card.js";
import { EntityPopupBadge } from "./badge.js";
import { CONTROL_TYPES } from "./controls.js";

if (!customElements.get("entity-popup-card"))
  customElements.define("entity-popup-card", EntityPopupCard);
if (!customElements.get("entity-popup-badge"))
  customElements.define("entity-popup-badge", EntityPopupBadge);
window.customBadges = window.customBadges || [];
if (!window.customBadges.some((badge) => badge.type === "entity-popup-badge")) {
  window.customBadges.push({
    type: "entity-popup-badge",
    name: "Entity Popup Badge",
    description: "A compact status badge that opens a live list of related entities.",
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
      if (
        !CONTROL_TYPES.has(domain) ||
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
                domain,
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
