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
   
export async function getAccessToken() {
  const sb = getSupabase();
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}
