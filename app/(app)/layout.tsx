import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { AppShell } from "@/components/providers/AppShell";
import { NotLinked } from "@/components/profile/NotLinked";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const result = await loadSession();
  if (result.status === "signed-out") redirect("/login");
  if (result.status === "not-linked") return <NotLinked email={result.email} />;

  return (
    <AppShell session={result.session} bond={result.bond}>
      {children}
    </AppShell>
  );
}
