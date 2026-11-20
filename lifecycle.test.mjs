import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

const window = new Window({ url: "http://localhost:8123/dashboard-home/main" });
Object.assign(globalThis, {
  window,
  document: window.document,
  customElements: window.customElements,
  HTMLElement: window.HTMLElement,
  CustomEvent: window.CustomEvent,
});

class FakeDialog extends HTMLElement {
  get open() {
    return this._open || false;
  }

  set open(value) {
    const wasOpen = this.open;
    this._open = Boolean(value);
    if (wasOpen && !this._open && !this._swipeClosing) {
      setTimeout(() => this.dispatchEvent(new window.Event("closed")), 0);
    }
  }

  get updateComplete() {
    return this._updateComplete || Promise.resolve();
  }

  swipeClosed() {
    this._swipeClosing = true;
    this.style.setProperty("--dialog-transform", "translateY(120px)");
    setTimeout(() => this.dispatchEvent(new window.Event("closed")), 0);
  }
}
customElements.define("ha-adaptive-dialog", FakeDialog);

window.loadCardHelpers = async () => ({
  createCardElement(config) {
    const card = document.createElement("div");
    card.config = config;
    return card;
  },
});

const { NativeEntityPopupCard } = await import("./src/native.js");
customElements.define("entity-popup-card", NativeEntityPopupCard);
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const config = {
  entity: "light.upstairs",
  card: {
    type: "custom:mushroom-template-card",
    entity: "light.upstairs",
    icon_tap_action: { action: "toggle" },
  },
  popup: {
    title: "Upstairs lights",
    width: 560,
    card: { type: "entities", entities: ["light.upstairs"] },
  },
};

async function makeCard() {
  const card = new NativeEntityPopupCard();
  card.setConfig(config);
  document.body.append(card);
  card.hass = { states: { "light.upstairs": { state: "on", attributes: {} } } };
  await tick();
  return card;
}

test("native entity filter shares the flat popup surface", async () => {
  const card = await makeCard();
  card.setConfig({
    ...config,
    popup: {
      ...config.popup,
      card: { type: "entity-filter", entities: ["light.upstairs"], state_filter: ["on"] },
    },
  });
  assert.equal(card._popup.classList.contains("flat"), true);
  assert.equal(card._content.classList.contains("flat"), true);
  card.setConfig({
    ...config,
    popup: {
      ...config.popup,
      card: {
        type: "entity-filter",
        entities: ["light.upstairs"],
        state_filter: ["on"],
        card: { type: "glance" },
      },
    },
  });
  assert.equal(card._popup.classList.contains("flat"), false);
  card.remove();
});

test("an open source popup only rebuilds when its row membership changes", async () => {
  const card = await makeCard();
  card.setConfig({
    ...config,
    popup: {
      card: { type: "entities" },
      source: { entity: "sensor.lights", state: "on" },
    },
  });
  const states = {
    "sensor.lights": { state: "1", attributes: { entity_id: ["light.upstairs", "light.hall"] } },
    "light.upstairs": { state: "on" },
    "light.hall": { state: "off" },
  };
  card.hass = { states };
  await card._open();
  await tick();
  const first = card._popupCard;
  const renderPopup = card._renderPopup.bind(card);
  let renders = 0;
  card._renderPopup = () => {
    renders++;
    return renderPopup();
  };
  card.hass = { states: { ...states, "sensor.clock": { state: "1" } } };
  assert.equal(renders, 0);
  assert.equal(card._popupCard, first);

  card.hass = { states: { ...states, "light.upstairs": { state: "off" } } };
  assert.equal(card._popupCard, first);
  card.hass = { states: { ...states, "light.hall": { state: "on" } } };
  await tick();
  assert.deepEqual(card._popupCard.config.entities, ["light.upstairs", "light.hall"]);
  card._dialog.open = false;
  await tick();
  card.remove();
});

test("swipe dismissal replaces the dragged sheet and preserves native card events", async () => {
  const card = await makeCard();
  const trigger = card._triggerCard;
  let nativeActions = 0;
  const onAction = () => nativeActions++;
  document.body.addEventListener("hass-action", onAction);

  trigger.dispatchEvent(
    new window.CustomEvent("hass-action", {
      bubbles: true,
      composed: true,
      detail: { action: "icon_tap", config: trigger.config },
    }),
  );
  assert.equal(nativeActions, 1, "the icon's native toggle action is left alone");
  assert.equal(card._dialog.open, false);

  trigger.dispatchEvent(
    new window.CustomEvent("ll-custom", {
      bubbles: true,
      composed: true,
      detail: { action: "fire-dom-event" },
    }),
  );
  await tick();
  const draggedDialog = card._dialog;
  const firstPopup = card._popupCard;
  assert.equal(draggedDialog.open, true);
  assert.equal(firstPopup.config.type, "entities");
  assert.equal(firstPopup.hass, card._hass);

  firstPopup.dispatchEvent(new window.Event("closed", { bubbles: true, composed: true }));
  await tick();
  assert.equal(card._dialog, draggedDialog, "a nested card's close event is ignored");

  firstPopup.dispatchEvent(
    new window.CustomEvent("hass-action", {
      bubbles: true,
      composed: true,
      detail: { action: "tap", config: { tap_action: { action: "toggle" } } },
    }),
  );
  assert.equal(nativeActions, 2, "popup actions remain available to Home Assistant");
  assert.equal(card._dialog.open, true);

  draggedDialog.swipeClosed();
  await tick();
  await tick();
  const freshDialog = card._dialog;
  assert.notEqual(freshDialog, draggedDialog);
  assert.equal(freshDialog.style.getPropertyValue("--dialog-transform"), "");
  assert.equal(card._dialogRoot.style.getPropertyValue("--entity-popup-width"), "560px");
  assert.equal(card._popupCard, null);
  assert.equal(card._dialogRoot.isConnected, false);

  trigger.dispatchEvent(
    new window.CustomEvent("ll-custom", {
      bubbles: true,
      composed: true,
      detail: { action: "fire-dom-event" },
    }),
  );
  await tick();
  assert.equal(freshDialog.open, true, "a fresh popup opens after swipe dismissal");
  assert.equal(card._title.textContent, "Upstairs lights");
  assert.equal(card._popupCard.config.type, "entities");
  draggedDialog.dispatchEvent(new window.Event("closed"));
  await tick();
  assert.equal(freshDialog.open, true, "a stale close cannot dismiss the new popup");

  const moreInfo = [];
  const onMoreInfo = (event) => moreInfo.push(event.detail.entityId);
  document.body.addEventListener("hass-more-info", onMoreInfo);
  card._popupCard.dispatchEvent(
    new window.CustomEvent("hass-more-info", {
      bubbles: true,
      composed: true,
      detail: { entityId: "light.upstairs" },
    }),
  );
  await tick();
  await tick();
  assert.deepEqual(moreInfo, ["light.upstairs"], "nested more-info opens after the popup closes");
  assert.notEqual(card._dialog, freshDialog, "the next open also gets a clean dialog");

  document.body.removeEventListener("hass-action", onAction);
  document.body.removeEventListener("hass-more-info", onMoreInfo);
  card.remove();
});

test("disconnect or config change cancels an unfinished open", async () => {
  const card = await makeCard();
  const firstDialog = card._dialog;
  let finishUpdate;
  firstDialog._updateComplete = new Promise((resolve) => (finishUpdate = resolve));
  const opening = card._open();
  card.remove();
  assert.equal(card._dialogRoot.isConnected, false);
  assert.equal(card._dialogActive, false);
  finishUpdate();
  await opening;
  assert.equal(firstDialog.open, false, "an old card cannot open after disconnecting");

  document.body.append(card);
  await card._open();
  assert.equal(firstDialog.open, true, "the card still opens after reconnecting");
  card.remove();
  assert.equal(card._dialogRoot.isConnected, true, "an already open popup survives a view update");
  firstDialog.swipeClosed();
  await tick();
  await tick();
  assert.equal(card._dialogRoot.isConnected, false);

  document.body.append(card);
  const nextDialog = card._dialog;
  let finishNextUpdate;
  nextDialog._updateComplete = new Promise((resolve) => (finishNextUpdate = resolve));
  const staleOpen = card._open();
  card.setConfig({ ...config, popup: { ...config.popup, title: "New title" } });
  finishNextUpdate();
  await staleOpen;
  assert.equal(nextDialog.open, false, "an old config cannot open a popup");
  assert.equal(card._dialogRoot.isConnected, false);
  await card._open();
  assert.equal(card._title.textContent, "New title");
  card._dialog.swipeClosed();
  await tick();
  await tick();
  card.remove();
});
