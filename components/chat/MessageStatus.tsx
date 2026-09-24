import { AlertIcon, CheckIcon, ClockIcon, DoubleCheckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { ChatMessage, ReceiptState } from "@/types/app";

export function receiptState(message: ChatMessage): ReceiptState {
  if (message.local) return message.local.status;
  if (message.read_at) return "read";
  if (message.delivered_at) return "delivered";
  return "sent";
}

const LABELS: Record<ReceiptState, string> = {
  sending: "Sending",
  failed: "Not sent",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
};

/** ✓ sent · ✓✓ delivered · accent ✓✓ read. Deliberately quiet. */
export function MessageStatus({ message }: { message: ChatMessage }) {
  const state = receiptState(message);
  const common = "inline-block";
  return (
    <span className={cn("inline-flex items-center", state === "read" ? "text-accent-text" : "text-muted")}>
      {state === "sending" && <ClockIcon size={12} className={cn(common, "animate-pulse")} />}
      {state === "failed" && <AlertIcon size={13} className={cn(common, "text-danger")} />}
      {state === "sent" && <CheckIcon size={14} className={common} />}
      {(state === "delivered" || state === "read") && <DoubleCheckIcon size={16} className={common} />}
      <span className="sr-only">{LABELS[state]}</span>
    </span>
  );
}
