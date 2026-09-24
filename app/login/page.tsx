import type { Metadata } from "next";
import { LoginForm } from "@/components/profile/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return <LoginForm />;
}
