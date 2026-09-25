import { readPref, writePref } from "./prefs";

/**
 * Napyru's own touch: a soft heartbeat, "lub-dub". Every cue is a variation
 * of it, so the phone feels like the app and not like a system alert.
 *
 * Android vibrates the exact pattern. iPhone has no vibration API; there we
 * tap a hidden iOS switch, which gives one light tick per tap, so a pattern
 * becomes a few ticks with the same rhythm. iPhone only allows this during a
 * tap or press, so incoming messages buzz on Android only.
 */
export type HapticCue = "send" | "receive" | "heart" | "press";

// [on, off, on, …] in milliseconds.
const PATTERNS: Record<HapticCue, number[]> = {
  send: [14, 70, 8],
  receive: [10, 90, 22],
  heart: [18, 60, 10, 110, 18, 60, 10],
  press: [12],
};

export function isHapticsEnabled() {
  return readPref("haptics") !== "off";
}

export function setHapticsEnabled(on: boolean) {
  writePref("haptics", on ? null : "off");
}

let iosSwitch: HTMLLabelElement | null = null;

function iosTick() {
  // A later tick of a pattern: you may have started typing since.
  if (isTyping()) return;
  // Clicking the switch moves focus to it; put focus straight back.
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (!iosSwitch) {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.cssText = "position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-9999px";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
  if (focused && document.activeElement !== focused) focused.focus({ preventScroll: true });
}

function isTyping() {
  const el = document.activeElement;
  return el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type !== "checkbox") || (el instanceof HTMLElement && el.isContentEditable);
}

export function haptic(cue: HapticCue) {
  if (typeof window === "undefined" || !isHapticsEnabled()) return;
  const pattern = PATTERNS[cue];
  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
    return;
  }
  if (!/iphone|ipad|ipod/i.test(navigator.userAgent)) return;
  // The switch trick steals focus, and iOS closes the keyboard the moment a
  // text box loses focus, even if focus comes straight back. So: no ticks
  // for arriving messages, and none at all while you're typing.
  if (cue === "receive" || isTyping()) return;
  // iPhone only ticks during a tap or press; outside one it does nothing.
  if (navigator.userActivation && !navigator.userActivation.isActive) return;
  // One tick per "on" step, at the same rhythm.
  let at = 0;
  pattern.forEach((ms, i) => {
    if (i % 2 === 0) {
      if (at === 0) iosTick();
      else setTimeout(iosTick, at);
    }
    at += ms;
  });
}
