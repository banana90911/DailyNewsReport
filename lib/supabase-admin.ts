import { createClient } from "@supabase/supabase-js";
import { getRequiredEnv } from "@/lib/env";

export function hasSupabaseStorageConfig(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

let supabaseAdminClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdminClient() {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const url = getRequiredEnv("SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  supabaseAdminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return supabaseAdminClient;
}

export function getSupabaseTtsBucket(): string {
  return process.env.SUPABASE_TTS_BUCKET?.trim() || "tts";
}
