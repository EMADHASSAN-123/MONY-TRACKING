import { edgeFetch } from "./apiClient.js";
import { getSupabase } from "./supabaseClient.js";
import { EDGE_FUNCTION_SLUGS, getConfig } from "../utils/constants.js";

function useEdge() {
  return getConfig().useEdgeFunctions;
}

/** @returns {Promise<any[]>} */
export async function fetchTasks() {
  if (useEdge()) {
    const body = await edgeFetch(EDGE_FUNCTION_SLUGS.TASKS, "", { method: "GET" });
    return body.data ?? [];
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from("tasks")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

/**
 * @param {string} id
 * @returns {Promise<{ data: any, events: any[] }>}
 */
export async function fetchTaskWithEvents(id) {
  if (useEdge()) {
    const body = await edgeFetch(EDGE_FUNCTION_SLUGS.TASKS, `?id=${encodeURIComponent(id)}`, { method: "GET" });
    return { data: body.data, events: body.events ?? [] };
  }
  const sb = getSupabase();
  const { data: task, error: te } = await sb.from("tasks").select("*").eq("id", id).maybeSingle();
  if (te) throw te;
  if (!task) throw new Error("المهمة غير موجودة");
  const { data: events, error: ee } = await sb
    .from("task_events")
    .select("*")
    .eq("task_id", id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (ee) throw ee;
  return { data: task, events: events ?? [] };
}

/**
 * @param {{
 *   title: string,
 *   description?: string,
 *   priority?: string,
 *   status?: string,
 *   due_at?: string|null,
 *   assigned_to: string
 * }} row
 */
export async function createTask(row) {
  if (useEdge()) {
    const body = await edgeFetch(EDGE_FUNCTION_SLUGS.TASKS, "", {
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
    .from("tasks")
    .insert({
      title: row.title,
      description: row.description ?? "",
      priority: row.priority ?? "medium",
      status: row.status ?? "pending",
      due_at: row.due_at ?? null,
      created_by: uid,
      assigned_to: row.assigned_to,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} patch
 */
export async function updateTask(id, patch) {
  if (useEdge()) {
    const body = await edgeFetch(EDGE_FUNCTION_SLUGS.TASKS, `?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return body.data;
  }
  const sb = getSupabase();
  const { data, error } = await sb.from("tasks").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

/** @param {string} id */
export async function deleteTask(id) {
  if (useEdge()) {
    await edgeFetch(EDGE_FUNCTION_SLUGS.TASKS, `?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    return true;
  }
  const sb = getSupabase();
  const { error } = await sb.from("tasks").delete().eq("id", id);
  if (error) throw error;
  return true;
}
