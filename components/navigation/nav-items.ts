import { BondIcon, CalendarIcon, ChatIcon, MapPinIcon, MemoriesIcon, SettingsIcon } from "@/components/ui/icons";

// Phones get five tabs (more gets cramped and slow to scan). Bond is used
// least, so on phones it opens from the partner's photo in the chat header.
export const NAV_ITEMS = [
  { href: "/chat", label: "Chat", Icon: ChatIcon, phone: true },
  { href: "/plans", label: "Plans", Icon: CalendarIcon, phone: true },
  { href: "/map", label: "Map", Icon: MapPinIcon, phone: true },
  { href: "/memories", label: "Memories", Icon: MemoriesIcon, phone: true },
  { href: "/bond", label: "Bond", Icon: BondIcon, phone: false },
  { href: "/settings", label: "Settings", Icon: SettingsIcon, phone: true },
] as const;

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
