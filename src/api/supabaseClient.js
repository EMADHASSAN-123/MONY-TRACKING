import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getConfig } from "../utils/constants.js";
 
/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let client = null;

export function getSupabase() {
  if (client) return client;
  const { supabaseUrl, supabaseAnonKey } = getConfig();
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("MONY: أضف supabaseUrl و supabaseAnonKey في MONY_CONFIG داخل index.html");
  }
  client = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder", {
    auth: { 
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

/** @type {{ token: string | null, untilSec: number }} */
let accessTokenCache = { token: null, untilSec: 0 };

export function clearAccessTokenCache() {
  accessTokenCache = { token: null, untilSec: 0 };
}

/**
 * يعيد رمز الوصول مع تخزين مؤقت حتى قرب انتهاء الجلسة لتقليل استدعاءات getSession المتكررة مع Edge.
 */
export async function getAccessToken() {
  const now = Date.now() / 1000;
  if (accessTokenCache.token && now < accessTokenCache.untilSec - 45) {
    return accessTokenCache.token;
  }
  const sb = getSupabase();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token ?? null;
  const exp = data.session?.expires_at;
  accessTokenCache = {
    token,
    untilSec: typeof exp === "number" ? exp : now + 300,
  };
  return token;
}
