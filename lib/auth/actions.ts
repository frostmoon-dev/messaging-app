"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MESSAGES } from "@/lib/errors";
import { isThemeId, THEME_COOKIE } from "@/lib/themes";

export type SignInState = { error: string | null; email: string };

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password || email.length > 254 || password.length > 128 || !email.includes("@")) {
    return { error: MESSAGES.signIn, email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (process.env.NODE_ENV !== "production") console.warn("[napyru] sign-in failed", error.message);
    const rateLimited = error.status === 429;
    return { error: rateLimited ? "Too many attempts. Wait a minute and try again." : MESSAGES.signIn, email };
  }
  redirect("/chat");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setTheme(theme: string) {
  if (!isThemeId(theme)) return;
  const store = await cookies();
  store.set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  });
}
