import type { Metadata } from "next";
import { MemoriesScreen } from "@/components/memories/MemoriesScreen";

export const metadata: Metadata = { title: "Memories" };

export default function MemoriesPage() {
  return <MemoriesScreen />;
}
