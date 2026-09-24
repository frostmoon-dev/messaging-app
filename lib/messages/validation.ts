export const MAX_MESSAGE_LENGTH = 4000;

export type ValidationResult = { ok: true; value: string } | { ok: false; reason: string };

export function validateMessageText(input: string): ValidationResult {
  const value = input.replace(/\r\n/g, "\n").trim();
  if (!value) return { ok: false, reason: "Message is empty." };
  if (value.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, reason: `Keep it under ${MAX_MESSAGE_LENGTH.toLocaleString()} characters.` };
  }
  return { ok: true, value };
}
