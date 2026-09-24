import type { Metadata } from "next";
import { ChatWindow } from "@/components/chat/ChatWindow";

export const metadata: Metadata = { title: "Chat" };

export default function ChatPage() {
  return <ChatWindow />;
}
