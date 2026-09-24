import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

// createBrowserClient is a singleton internally, so calling this often is cheap.
export function createClient() {
  const { url, key } = getSupabaseEnv();
  return createBrowserClient<Database>(url, key);
}

export type BrowserSupabase = ReturnType<typeof createClient>;
