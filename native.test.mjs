import assert from "node:assert/strict";
import test from "node:test";

globalThis.HTMLElement = class {};
const { sourceRows, validateNativeConfig } = await import("./src/native.js");

const state = (value, name, attributes = {}) => ({
  state: value,
  attributes: { friendly_name: name, ...attributes },
});
const config = {
  entity: "light.upstrairs",
  card: { type: "custom:mushroom-template-card", entity: "light.upstrairs" },
  popup: {
    title: "Upstairs lights",
    source: { recursive: true, domain: "light", state: "on" },
    card: { type: "entities", show_header_toggle: false },
  },
};

test("a native popup chooses both card types and validates its source", () => {
  assert.doesNotThrow(() => validateNativeConfig(config));
  assert.throws(
    () =>
      validateNativeConfig({
        ...config,
        popup: { ...config.popup, card: { type: "entities", entities: [] } },
      }),
    /supplies the entities/,
  );
  assert.throws(
    () =>
      validateNativeConfig({
        ...config,
        popup: { ...config.popup, source: { attribute: "__proto__" } },
      }),
    /attribute name/,
  );
  assert.throws(
    () => validateNativeConfig({ ...config, popup: { ...config.popup, sections: [] } }),
    /legacy popup options/,
  );
});

test("a group supplies active light rows in source order without a duplicate entity list", () => {
  const states = {
    "light.upstrairs": state("on", "Upstairs", { entity_id: ["light.group", "light.staircase"] }),
    "light.group": state("on", "Group", { entity_id: ["light.zed", "light.alpha", "light.group"] }),
    "light.zed": state("on", "Zed"),
    "light.alpha": state("off", "Alpha"),
    "light.staircase": state("on", "Staircase"),
  };
  const rows = sourceRows(states, config.entity, config.popup.source);
  assert.deepEqual(rows, ["light.zed", "light.staircase"]);
  assert.deepEqual(
    sourceRows(states, config.entity, config.popup.source, new Set(["light.alpha"])),
    ["light.zed", "light.alpha", "light.staircase"],
  );
  assert.equal(
    sourceRows(
      { "light.upstrairs": state("unavailable", "Upstairs") },
      config.entity,
      config.popup.source,
    ),
    null,
  );
});

test("sensor lists and issue records keep their own membership", () => {
  const states = {
    "sensor.open_windows": state("1", "Open windows", { entity_id: ["binary_sensor.window"] }),
    "binary_sensor.window": state("on", "Window"),
    "binary_sensor.attention": state("on", "Attention", {
      items: [{ entity: "sensor.filter", name: "RO filter", value: "2 days overdue" }],
    }),
    "sensor.filter": state("-2", "Filter"),
  };
  assert.deepEqual(sourceRows(states, "sensor.open_windows", { state: "on" }), [
    "binary_sensor.window",
  ]);
  assert.deepEqual(sourceRows(states, "binary_sensor.attention", { attribute: "items" }), [
    { entity: "sensor.filter", name: "RO filter · 2 days overdue" },
  ]);
});
