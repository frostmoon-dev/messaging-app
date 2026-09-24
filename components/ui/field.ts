// Shared form styles so every input looks and behaves the same.
// 16px text stops iOS Safari from zooming into the field on focus.
export const fieldClass =
  "w-full min-h-11 rounded-xl border-2 border-field-border bg-panel shadow-[var(--shadow-inset)] px-3.5 py-2.5 text-body text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent focus-visible:outline-none aria-[invalid=true]:border-danger";

export const labelClass = "mb-1.5 block text-small font-semibold text-muted-strong";
