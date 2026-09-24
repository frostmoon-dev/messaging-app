import type { Metadata } from "next";
import { PlansScreen } from "@/components/plans/PlansScreen";

export const metadata: Metadata = { title: "Plans" };

export default function PlansPage() {
  return <PlansScreen />;
}
