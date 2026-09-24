/**
 * Was the last thing the person did a key press? Used to decide whether to
 * hand focus back after a sheet closes: keyboard users need it, but on a
 * touch screen it makes iPhone Safari draw a focus ring on the button.
 */
let lastWasKeyboard = false;

if (typeof window !== "undefined") {
  window.addEventListener("keydown", () => (lastWasKeyboard = true), true);
  window.addEventListener("pointerdown", () => (lastWasKeyboard = false), true);
}

export function usedKeyboardLast() {
  return lastWasKeyboard;
}
