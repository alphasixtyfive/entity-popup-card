import { NativeEntityPopupCard } from "./native.js";
import { NativeEntityPopupBadge } from "./native-badge.js";

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
    documentationURL: "https://github.com/alphasixtyfive/entity-popup-card",
  });
}

window.customBadges = window.customBadges || [];
if (!window.customBadges.some((badge) => badge.type === "entity-popup-badge")) {
  window.customBadges.push({
    type: "entity-popup-badge",
    name: "Entity Popup Badge",
    description: "Open a Lovelace card from a Mushroom badge.",
  });
}
