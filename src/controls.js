// Each quick action has known states and a matching Home Assistant service.
// Covers use an action button because open/close is clearer than an on/off switch.
const ON_OFF = Object.freeze({
  activeStates: ["on"],
  inactiveStates: ["off"],
  activeState: "on",
  inactiveState: "off",
  turnOn: "turn_on",
  turnOff: "turn_off",
  onLabel: "Turn on",
  offLabel: "Turn off",
  presentation: "switch",
  activeLabel: "on",
});

const COVER = Object.freeze({
  activeStates: ["open", "opening"],
  inactiveStates: ["closed", "closing"],
  activeState: "open",
  inactiveState: "closed",
  turnOn: "open_cover",
  turnOff: "close_cover",
  onLabel: "Open",
  offLabel: "Close",
  presentation: "button",
  activeLabel: "open",
});

export const CONTROL_TYPES = new Map([
  ["light", ON_OFF],
  ["switch", ON_OFF],
  ["fan", ON_OFF],
  ["input_boolean", ON_OFF],
  ["cover", COVER],
]);

export function controlFor(entityId) {
  return CONTROL_TYPES.get(entityId?.split(".")[0]);
}

export function isActive(control, state) {
  return control?.activeStates.includes(state) ?? false;
}

export function isKnown(control, state) {
  return control?.activeStates.includes(state) || control?.inactiveStates.includes(state) || false;
}

export function actionFor(control, state) {
  if (state === control.activeState) {
    return {
      service: control.turnOff,
      label: control.offLabel,
      target: control.inactiveState,
      confirmedStates: control.inactiveStates,
    };
  }
  if (state === control.inactiveState) {
    return {
      service: control.turnOn,
      label: control.onLabel,
      target: control.activeState,
      confirmedStates: control.activeStates,
    };
  }
  return null;
}
