import type { Metadata } from "next";
import { BondScreen } from "@/components/bond/BondScreen";

export const metadata: Metadata = { title: "Bond" };

export default function BondPage() {
  return <BondScreen />;
}
