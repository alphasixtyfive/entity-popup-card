import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { atPath, collectSection } from "./src/data.js";
import { actionFor, controlFor } from "./src/controls.js";

const file = fileURLToPath(new URL("./entity-popup-card.js", import.meta.url));
const state = (value, name, attrs = {}) => ({
  state: value,
  attributes: { friendly_name: name, ...attrs },
});

test("member groups flatten safely and count only current active leaves", () => {
  const states = {
    "light.floor": state("on", "Floor", {
      entity_id: ["light.nested", "light.a", "light.missing"],
    }),
    "light.nested": state("on", "Nested", { entity_id: ["light.b", "light.a", "light.floor"] }),
    "light.a": state("on", "Alpha"),
    "light.b": state("off", "Beta"),
  };
  const section = {
    source: "members",
    attribute: "entity_id",
    recursive: true,
    domain: "light",
    show: "active",
  };
  const result = collectSection(states, "light.floor", section);
  assert.deepEqual(
    result.items.map((item) => item.entity),
    ["light.a"],
  );
  assert.equal(result.activeCount, 1);
  assert.deepEqual(
    result.unavailable.map((item) => item.entity),
    ["light.missing"],
  );
  assert.equal(result.membershipKnown, true);
  assert.equal(collectSection({}, "light.floor", section).membershipKnown, false);
});

test("open windows use helper members without a fixed sensor list", () => {
  const states = {
    "sensor.open_windows": state("2", "Open windows", {
      entity_ids: [
        "binary_sensor.bedroom_window",
        "binary_sensor.study_window",
        "binary_sensor.kitchen_window",
      ],
    }),
    "binary_sensor.bedroom_window": state("on", "Bedroom window"),
    "binary_sensor.study_window": state("off", "Study window"),
    "binary_sensor.kitchen_window": state("unavailable", "Kitchen window"),
  };
  const result = collectSection(states, "sensor.open_windows", {
    source: "members",
    attribute: "entity_ids",
    domain: "binary_sensor",
    show: "active",
  });
  assert.deepEqual(
    result.items.map((item) => item.name),
    ["Bedroom window"],
  );
  assert.deepEqual(
    result.unavailable.map((item) => item.name),
    ["Kitchen window"],
  );
  assert.equal(result.activeCount, 1);
});

test("matching pollen and nested bin values need no dashboard sensor enumeration", () => {
  const states = {
    "sensor.air": state("good", "Air"),
    "sensor.kleenex_pollen_birch_level": state("low", "Birch"),
    "sensor.kleenex_pollen_oak_level": state("high", "Oak"),
    "sensor.bin_collection": state("1", "Bins", { plan: { required: ["blue", "brown", "black"] } }),
  };
  const pollen = collectSection(states, "sensor.air", {
    source: "match",
    prefix: "sensor.kleenex_pollen_",
    suffix: "_level",
  });
  assert.deepEqual(
    pollen.items.map((item) => item.name),
    ["Birch", "Oak"],
  );
  const bins = collectSection(states, "sensor.bin_collection", {
    source: "values",
    attribute: "plan.required",
    item_suffix: " bin",
  });
  assert.deepEqual(
    bins.items.map((item) => item.name),
    ["Blue bin", "Brown bin", "Black bin"],
  );
  assert.equal(atPath({ plan: { required: ["black"] } }, "plan.required")[0], "black");
  assert.equal(atPath({}, "__proto__"), undefined);
});

test("mixed groups omit other domains and explicit entity lists keep their order", () => {
  const states = {
    "light.floor": state("on", "Floor", { entity_id: ["switch.socket", "light.lamp"] }),
    "light.lamp": state("on", "Lamp"),
    "switch.socket": state("on", "Socket"),
  };
  const lights = collectSection(states, "light.floor", {
    source: "members",
    recursive: true,
    domain: "light",
    mode: "controls",
  });
  assert.deepEqual(
    lights.items.map((item) => item.entity),
    ["light.lamp"],
  );
  assert.deepEqual(lights.unavailable, []);
  assert.deepEqual(
    collectSection(states, "sensor.missing", {
      source: "entities",
      entities: ["switch.socket", "light.lamp"],
    }).items.map((item) => item.entity),
    ["switch.socket", "light.lamp"],
  );
});

test("cover controls count open and opening states and use cover actions", () => {
  const states = {
    "cover.floor": state("open", "Floor covers", {
      entity_id: ["cover.a", "cover.b", "cover.c", "cover.d"],
    }),
    "cover.a": state("open", "A"),
    "cover.b": state("opening", "B"),
    "cover.c": state("closed", "C"),
    "cover.d": state("closing", "D"),
  };
  const result = collectSection(states, "cover.floor", {
    source: "members",
    domain: "cover",
    mode: "controls",
    show: "active",
  });
  assert.equal(result.activeCount, 2);
  assert.deepEqual(
    result.items.map((item) => item.entity),
    ["cover.a", "cover.b"],
  );
  assert.equal(result.unavailable.length, 0);
  assert.equal(actionFor(controlFor("cover.a"), "open").service, "close_cover");
  assert.equal(actionFor(controlFor("cover.c"), "closed").service, "open_cover");
  assert.equal(actionFor(controlFor("cover.b"), "opening"), null);
});

function environment(config, states) {
  let document;
  class Element extends EventTarget {
    constructor(tag = "div") {
      super();
      this.tagName = tag;
      this.children = [];
      this.attrs = {};
      this.style = {};
      this._connected = false;
      this.hidden = false;
      this.open = false;
    }
    get isConnected() {
      return this.parent ? this.parent.isConnected : this._connected;
    }
    attachShadow() {
      this.shadowRoot = new Shadow(this);
      return this.shadowRoot;
    }
    append(...nodes) {
      for (const node of nodes) {
        node.parent = this;
        this.children.push(node);
      }
    }
    replaceChildren(...nodes) {
      for (const node of this.children) node.parent = null;
      this.children = [];
      this.append(...nodes);
    }
    insertBefore(node, before) {
      if (node.parent)
        node.parent.children = node.parent.children.filter((child) => child !== node);
      node.parent = this;
      const index = before ? this.children.indexOf(before) : this.children.length;
      this.children.splice(index < 0 ? this.children.length : index, 0, node);
    }
    remove() {
      if (this.parent)
        this.parent.children = this.parent.children.filter((child) => child !== this);
      this.parent = null;
    }
    setAttribute(key, value) {
      this.attrs[key] = value;
    }
    removeAttribute(key) {
      delete this.attrs[key];
    }
    focus() {
      document.activeElement = this;
      this.focusCount = (this.focusCount || 0) + 1;
    }
    showModal() {
      if (this.open) throw Error("Already open");
      this.open = true;
    }
    close() {
      if (this.open) {
        this.open = false;
        this.dispatchEvent(new Event("close"));
      }
    }
    getBoundingClientRect() {
      return { left: 10, right: 400, top: 10, bottom: 400 };
    }
  }
  class Shadow extends Element {
    constructor(host) {
      super("shadow-root");
      this.host = host;
      this.nodes = {};
    }
    get isConnected() {
      return this.host.isConnected;
    }
    set innerHTML(html) {
      this.html = html;
      for (const selector of [
        ".tile",
        "dialog",
        "h2",
        ".status",
        ".sections",
        ".error",
        ".close",
      ]) {
        this.nodes[selector] = new Element(selector);
        this.nodes[selector].parent = this;
      }
    }
    querySelector(selector) {
      return this.nodes[selector];
    }
  }
  class DetailEvent extends Event {
    constructor(type, detail, path = []) {
      super(type, { bubbles: true, cancelable: true });
      this.detail = detail;
      this.path = path;
      this.stopCount = 0;
    }
    stopPropagation() {
      this.stopCount++;
      super.stopPropagation();
    }
    composedPath() {
      return this.path;
    }
  }
  class CustomEvent extends Event {
    constructor(type, options) {
      super(type, options);
      this.detail = options.detail;
    }
  }
  const classes = new Map();
  const created = [];
  const services = [];
  const timers = new Map();
  let nextTimer = 1;
  document = {
    activeElement: null,
    body: new Element("body"),
    createElement: (tag) => new Element(tag),
  };
  document.body._connected = true;
  document.activeElement = document.body;
  const helpers = {
    createCardElement: (childConfig) => {
      const child = new Element("mushroom-template-card");
      child.config = childConfig;
      child.attachShadow();
      created.push(child);
      return child;
    },
  };
  const browserWindow = { loadCardHelpers: () => Promise.resolve(helpers) };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), {
    HTMLElement: Element,
    document,
    window: browserWindow,
    CustomEvent,
    customElements: {
      get: (name) => classes.get(name),
      define: (name, type) => classes.set(name, type),
    },
    setTimeout: (callback) => {
      const id = nextTimer++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    console: { error: () => {} },
  });
  const Card = classes.get("entity-popup-card");
  const card = new Card();
  card.setConfig(config);
  card.hass = {
    states,
    callService: (...args) => {
      services.push(args);
      return Promise.resolve();
    },
  };
  card._connected = true;
  card.connectedCallback();
  const tap = (action) =>
    new DetailEvent(
      "hass-action",
      { action: "tap", config: { entity: config.entity, tap_action: { action } } },
      [card._card, card],
    );
  return { card, created, services, tap, timers, classes, browserWindow };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("lights popup preserves tile icon action and has guarded, reversible controls", async () => {
  const config = {
    type: "custom:entity-popup-card",
    entity: "light.floor",
    primary: "Floor lights",
    icon_tap_action: { action: "toggle" },
    popup: {
      title: "Floor lights",
      sections: [
        {
          source: "members",
          attribute: "entity_id",
          recursive: true,
          domain: "light",
          mode: "controls",
          show: "active",
          singular: "light",
          plural: "lights",
          active_label: "on",
          show_state: true,
          row_action: "more-info",
        },
      ],
    },
  };
  const states = {
    "light.floor": state("on", "Floor", { entity_id: ["light.a", "light.b"] }),
    "light.a": state("on", "Alpha"),
    "light.b": state("off", "Beta"),
  };
  const env = environment(config, states);
  await flush();
  assert.equal(env.created[0].config.icon_tap_action.action, "toggle");
  assert.equal(env.created[0].config.tap_action.action, "fire-dom-event");
  assert.equal(env.created[0].config.popup, undefined);
  env.card.dispatchEvent(env.tap("fire-dom-event"));
  assert.equal(env.card._status.textContent, "1 light on");
  const row = env.card._rows.get("0:light.a");
  assert.equal(row.control.attrs.role, "switch");
  assert.equal(row.rowButton.attrs["aria-label"], "Alpha. More information");
  assert.equal(row.detail.textContent, "On");
  assert.equal(row.row.attrs["data-state"], "on");
  row.control.dispatchEvent(new Event("click"));
  await flush();
  assert.deepEqual(servicesAsJson(env.services), [["light", "turn_off", { entity_id: "light.a" }]]);
  assert.equal(row.control.disabled, true, "wait for the actual state");
  states["light.a"].state = "off";
  env.card.hass = env.card._hass;
  assert.equal(env.card._rows.get("0:light.a"), row, "keep focused row after update");
  assert.equal(row.control.disabled, false);
  assert.equal(row.control.attrs["aria-checked"], "false");
  assert.equal(row.detail.textContent, "Off");
  assert.equal(
    env.card._sectionNodes.get(0).list.children.length,
    1,
    "off row remains reversible until close",
  );
  states["light.floor"].attributes.entity_id = [];
  env.card.hass = env.card._hass;
  assert.equal(env.card._sectionNodes.get(0).list.children.length, 0);
  await env.card._change(0, "light.a");
  assert.equal(env.services.length, 1, "removed member cannot be controlled");
  states["light.floor"].attributes.entity_id = ["light.b"];
  states["light.b"].state = "on";
  env.card.hass = env.card._hass;
  env.card.dispatchEvent(env.tap("fire-dom-event"));
  let inspected;
  env.card.addEventListener("hass-more-info", (event) => {
    inspected = event.detail.entityId;
  });
  env.card._rows.get("0:light.b").rowButton.dispatchEvent(new Event("click"));
  assert.equal(inspected, "light.b");
  assert.equal(env.card._dialog.open, false);
});

test("cover rows use labeled buttons and wait through movement", async () => {
  const config = {
    entity: "cover.floor",
    card: { type: "tile", entity: "cover.floor" },
    popup: {
      sections: [
        {
          source: "members",
          domain: "cover",
          mode: "controls",
          show: "all",
          row_action: "more-info",
        },
      ],
    },
  };
  const states = {
    "cover.floor": state("open", "Floor covers", { entity_id: ["cover.blind"] }),
    "cover.blind": state("open", "Blind"),
  };
  const env = environment(config, states);
  await flush();
  env.card.dispatchEvent(env.tap("fire-dom-event"));
  const row = env.card._rows.get("0:cover.blind");
  assert.equal(row.control.className, "cover-action");
  assert.equal(row.control.attrs.role, undefined);
  assert.equal(row.control.textContent, "Close");
  assert.equal(row.control.attrs["aria-label"], "Close Blind");
  row.control.dispatchEvent(new Event("click"));
  await flush();
  assert.deepEqual(servicesAsJson(env.services), [
    ["cover", "close_cover", { entity_id: "cover.blind" }],
  ]);
  states["cover.blind"].state = "closing";
  env.card.hass = env.card._hass;
  assert.equal(row.control.disabled, true);
  assert.equal(row.control.textContent, "Moving");
  states["cover.blind"].state = "closed";
  env.card.hass = env.card._hass;
  assert.equal(row.control.disabled, false);
  assert.equal(row.control.textContent, "Open");
});

test("an active control list keeps the configured entity order", async () => {
  const config = {
    entity: "switch.b",
    card: { type: "tile", entity: "switch.b" },
    popup: {
      sections: [
        {
          source: "entities",
          entities: ["switch.b", "switch.a"],
          mode: "controls",
          show: "active",
        },
      ],
    },
  };
  const states = {
    "switch.a": state("on", "A"),
    "switch.b": state("on", "B"),
  };
  const env = environment(config, states);
  await flush();
  env.card.dispatchEvent(env.tap("fire-dom-event"));
  const rows = [env.card._rows.get("0:switch.b").row, env.card._rows.get("0:switch.a").row];
  assert.deepEqual(env.card._sectionNodes.get(0).list.children, rows);
  states["switch.b"].state = "off";
  env.card.hass = env.card._hass;
  assert.deepEqual(env.card._sectionNodes.get(0).list.children, rows);
});

test("Mushroom fire-dom-event opens the popup", async () => {
  const env = environment(
    {
      entity: "sensor.air",
      primary: "Air",
      popup: {
        sections: [{ source: "entities", entities: ["sensor.air"], show_state: true }],
      },
    },
    { "sensor.air": state("good", "Air") },
  );
  await flush();
  const event = new Event("ll-custom");
  event.detail = { action: "fire-dom-event" };
  event.composedPath = () => [env.card._card, env.card];
  env.card.dispatchEvent(event);
  assert.equal(env.card._dialog.open, true);
});

function servicesAsJson(services) {
  return JSON.parse(JSON.stringify(services));
}

test("read-only window popup has no control and exposes per-window details", async () => {
  const config = {
    type: "custom:entity-popup-card",
    entity: "sensor.open_windows",
    primary: "Windows",
    compact: true,
    icon_tap_action: { action: "more-info" },
    popup: {
      title: "Open windows",
      sections: [
        {
          source: "members",
          attribute: "entity_ids",
          domain: "binary_sensor",
          show: "active",
          mode: "view",
          row_action: "more-info",
          details: [{ field: "last_changed", label: "Since", format: "datetime" }],
        },
      ],
    },
  };
  const states = {
    "sensor.open_windows": state("1", "Windows", {
      entity_ids: ["binary_sensor.bedroom", "binary_sensor.study"],
    }),
    "binary_sensor.bedroom": { ...state("on", "<Bedroom>"), last_changed: "2026-09-24T07:30:00Z" },
    "binary_sensor.study": state("off", "Study"),
  };
  const env = environment(config, states);
  await flush();
  env.card.dispatchEvent(env.tap("fire-dom-event"));
  assert.equal(env.card.attrs.compact, "");
  assert.equal(env.created[0].config.compact, undefined);
  const row = env.card._rows.get("0:binary_sensor.bedroom");
  assert.equal(row.name.textContent, "<Bedroom>");
  assert.match(row.detail.textContent, /Since/);
  assert.equal(row.control.attrs.role, undefined);
  assert.equal(env.services.length, 0);
  let inspected;
  env.card.addEventListener("hass-more-info", (event) => {
    inspected = event.detail.entityId;
  });
  row.control.dispatchEvent(new Event("click"));
  assert.equal(inspected, "binary_sensor.bedroom");
  assert.equal(env.card._dialog.open, false, "close details before opening native more-info");
});

test("show all keeps off controls visible and a native tile needs no tap config", async () => {
  const config = {
    type: "custom:entity-popup-card",
    entity: "light.floor",
    card: { type: "tile", entity: "light.floor" },
    popup: { sections: [{ source: "members", domain: "light", mode: "controls", show: "all" }] },
  };
  const states = {
    "light.floor": state("on", "Floor", { entity_id: ["light.a", "light.b"] }),
    "light.a": state("on", "Alpha"),
    "light.b": state("off", "Beta"),
  };
  const env = environment(config, states);
  await flush();
  assert.equal(env.created[0].config.type, "tile");
  assert.equal(env.created[0].config.tap_action.action, "fire-dom-event");
  assert.equal(env.browserWindow.customCards[0].type, "entity-popup-card");
  assert.equal(env.classes.get("entity-popup-card").getStubConfig().card.type, "tile");
  env.card.dispatchEvent(env.tap("fire-dom-event"));
  assert.deepEqual([...env.card._rows.keys()], ["0:light.a", "0:light.b"]);
  assert.equal(env.card._rows.get("0:light.b").control.disabled, false);
  env.card._rows.get("0:light.b").control.dispatchEvent(new Event("click"));
  await flush();
  assert.deepEqual(servicesAsJson(env.services), [["light", "turn_on", { entity_id: "light.b" }]]);
});

test("entity readings have no misleading active count and use HA state formatting", async () => {
  const config = {
    type: "custom:entity-popup-card",
    entity: "sensor.air",
    card: { type: "tile" },
    popup: {
      sections: [
        { source: "entities", entities: ["sensor.air"], show_state: true, row_action: "more-info" },
      ],
    },
  };
  const states = { "sensor.air": state("21", "Air", { unit_of_measurement: "°C" }) };
  const env = environment(config, states);
  await flush();
  env.card._hass.formatEntityState = () => "21 °C";
  env.card.dispatchEvent(env.tap("fire-dom-event"));
  assert.equal(env.card._status.hidden, true);
  assert.equal(env.card._dialog.attrs["aria-describedby"], undefined);
  assert.equal(env.card._rows.get("0:sensor.air").detail.textContent, "21 °C");
});

test("a read-only list shows selected states and change times without controls", async () => {
  const config = {
    type: "custom:entity-popup-card",
    entity: "input_boolean.house_mode",
    compact: true,
    popup: {
      title: "House modes",
      sections: [
        {
          source: "entities",
          show_state: true,
          state_labels: { on: "Enabled", off: "Off" },
          entities: [
            { entity: "input_boolean.house_mode", name: "House mode" },
            { entity: "input_boolean.guest_mode", name: "Guest mode" },
          ],
          details: [{ field: "last_changed", label: "Changed", format: "datetime" }],
        },
      ],
    },
  };
  const states = {
    "input_boolean.house_mode": {
      ...state("off", "House mode"),
      last_changed: "2026-09-24T07:30:00Z",
    },
    "input_boolean.guest_mode": {
      ...state("on", "Guest mode"),
      last_changed: "2026-09-24T07:31:00Z",
    },
    "input_boolean.other_home": state("on", "Other home"),
  };
  const env = environment(config, states);
  await flush();
  env.card.dispatchEvent(env.tap("fire-dom-event"));
  assert.equal(env.card._rows.size, 2);
  assert.equal(env.card._rows.has("0:input_boolean.other_home"), false);
  assert.match(
    env.card._rows.get("0:input_boolean.guest_mode").detail.textContent,
    /Enabled · Changed/,
  );
  assert.equal(env.card._rows.get("0:input_boolean.guest_mode").control, undefined);
  assert.equal(env.services.length, 0);
});
