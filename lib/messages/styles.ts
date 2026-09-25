import { isMessageStyle, type MessageStyle } from "./api";

export const STYLE_OPTIONS: Array<{ id: MessageStyle | null; label: string; sample: string }> = [
  { id: null, label: "Plain", sample: "Aa" },
  { id: "script", label: "Script", sample: "Aa" },
  { id: "big", label: "Big", sample: "Aa" },
  { id: "whisper", label: "Whisper", sample: "aa" },
  { id: "mono", label: "Typewriter", sample: "Aa" },
];

/** The CSS class for a stored style; unknown or missing styles show plain. */
export function styleClass(style: unknown) {
  return isMessageStyle(style) ? `msg-style-${style}` : "";
}
