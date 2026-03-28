import { edgeFetch } from "./apiClient.js";
import { getSupabase } from "./supabaseClient.js";
import { EDGE_FUNCTION_SLUGS, getConfig } from "../utils/constants.js";

function useEdge() {
  return getConfig().useEdgeFunctions;
}

export async function fetchTransactions() {
  if (useEdge()) {
    const body = await edgeFetch(EDGE_FUNCTION_SLUGS.TRANSACTIONS, "", { method: "GET" });
    return body.data ?? [];
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from("transactions")
    .select("*")
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

/**
 * @param {{ sender: string, beneficiary: string, amount: number, transaction_date: string, category?: string }} row
 */
export async function createTransaction(row) {
  if (useEdge()) {
    const body = await edgeFetch(EDGE_FUNCTION_SLUGS.TRANSACTIONS, "", {
      method: "POST",
      body: JSON.stringify(row),
    });
    return body.data;
  }
  const sb = getSupabase();
  const { data: u } = await sb.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("غير مصرح");
  const { data, error } = await sb
    .from("transactions")
    .insert({
      user_id: uid,
      sender: row.sender,
      beneficiary: row.beneficiary,
      amount: row.amount,
      transaction_date: row.transaction_date,
      category: row.category ?? "general",
      currency: row.currency ?? "SAR",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * @param {string} id
 * @param {Partial<{ sender: string, beneficiary: string, amount: number, transaction_date: string, category: string }>} patch
 */
export async function updateTransaction(id, patch) {
  if (useEdge()) {
    const body = await edgeFetch(EDGE_FUNCTION_SLUGS.TRANSACTIONS, `?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return body.data;
  }
  const sb = getSupabase();
  const { data, error } = await sb.from("transactions").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

/** @param {string} id */
export async function deleteTransaction(id) {
  if (useEdge()) {
    await edgeFetch(EDGE_FUNCTION_SLUGS.TRANSACTIONS, `?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    return true;
  }
  const sb = getSupabase();
  const { error } = await sb.from("transactions").delete().eq("id", id);
  if (error) throw error;
  return true;
}
