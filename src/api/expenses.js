import { edgeFetch } from "./apiClient.js";
import { getSupabase } from "./supabaseClient.js";
import { EDGE_FUNCTION_SLUGS, getConfig } from "../utils/constants.js";

function useEdge() {
  return getConfig().useEdgeFunctions;
}

/**
 * @param {string} [transactionId] تصفية اختيارية بالحوالة (نفس منطق Edge)
 */
export async function fetchExpenses(transactionId) {
  const q = transactionId ? `?transaction_id=${encodeURIComponent(transactionId)}` : "";
  if (useEdge()) {
    const body = await edgeFetch(EDGE_FUNCTION_SLUGS.EXPENSES, q, { method: "GET" });
    return body.data ?? [];
  }
  const sb = getSupabase();
  let query = sb
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (transactionId) query = query.eq("transaction_id", transactionId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * @param {{ description: string, amount: number, expense_date: string, category?: string, transaction_id: string }} row
 */
export async function createExpense(row) {
  if (!row.transaction_id) throw new Error("يجب اختيار حوالة");
  if (useEdge()) {
    const body = await edgeFetch(EDGE_FUNCTION_SLUGS.EXPENSES, "", {
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
    .from("expenses")
    .insert({
      user_id: uid,
      transaction_id: row.transaction_id,
      description: row.description,
      amount: row.amount,
      expense_date: row.expense_date,
      category: row.category ?? "general",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * @param {string} id
 * @param {Partial<{ description: string, amount: number, expense_date: string, category: string, transaction_id: string }>} patch
 */
export async function updateExpense(id, patch) {
  if (useEdge()) {
    const body = await edgeFetch(EDGE_FUNCTION_SLUGS.EXPENSES, `?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return body.data;
  }
  const sb = getSupabase();
  const { data, error } = await sb.from("expenses").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

/** @param {string} id */
export async function deleteExpense(id) {
  if (useEdge()) {
    await edgeFetch(EDGE_FUNCTION_SLUGS.EXPENSES, `?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    return true;
  }
  const sb = getSupabase();
  const { error } = await sb.from("expenses").delete().eq("id", id);
  if (error) throw error;
  return true;
}
