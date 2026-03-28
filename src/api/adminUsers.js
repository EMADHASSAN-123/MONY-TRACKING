import { edgeFetch } from "./apiClient.js";
import { getSupabase } from "./supabaseClient.js";
import { EDGE_FUNCTION_SLUGS, getConfig } from "../utils/constants.js";

function useEdge() {
  return getConfig().useEdgeFunctions;
}

/** @returns {Promise<Array<{ id: string, email: string, role: string, full_name?: string, created_at?: string }>>} */
export async function listDirectoryUsers() {
  if (useEdge()) {
    const body = await edgeFetch(EDGE_FUNCTION_SLUGS.ADMIN_USERS, "", { method: "GET" });
    return body.data ?? [];
  }
  const sb = getSupabase();
  const { data: profs, error: pe } = await sb
    .from("profiles")
    .select("id, role, full_name, created_at")
    .order("created_at", { ascending: false });
  if (pe) throw pe;
  return profs ?? [];
}

/**
 * @param {{ email: string, password: string, role?: string, full_name?: string }} payload
 */
export async function createUserByAdmin(payload) {
  if (!useEdge()) {
    throw new Error("إنشاء مستخدم يتطلب نشر Edge Function admin-users و useEdgeFunctions: true");
  }
  const body = await edgeFetch(EDGE_FUNCTION_SLUGS.ADMIN_USERS, "", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return body.data;
}

/**
 * @param {string} userId
 * @param {{ role: string }} patch
 */
export async function updateUserRole(userId, patch) {
  if (!useEdge()) {
    throw new Error("تعديل الأدوار يتطلب Edge Function admin-users");
  }
  const body = await edgeFetch(EDGE_FUNCTION_SLUGS.ADMIN_USERS, `?id=${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return body.data;
}
