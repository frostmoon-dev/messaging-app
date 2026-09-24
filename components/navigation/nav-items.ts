import { BondIcon, ChatIcon, MemoriesIcon, SettingsIcon } from "@/components/ui/icons";

export const NAV_ITEMS = [
  { href: "/chat", label: "Chat", Icon: ChatIcon },
  { href: "/bond", label: "Bond", Icon: BondIcon },
  { href: "/memories", label: "Memories", Icon: MemoriesIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
] as const;

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
