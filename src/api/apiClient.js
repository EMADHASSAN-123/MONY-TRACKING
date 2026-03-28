import { getConfig } from "../utils/constants.js";
import { getAccessToken, getSupabase } from "./supabaseClient.js";

const REQUEST_TIMEOUT_MS = 12000;
const RETRY_DELAY_MS = 450;
const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * @param {string} message
 */
function toSafeErrorMessage(message) {
  const txt = String(message || "").toLowerCase();
  if (txt.includes("jwt") || txt.includes("token") || txt.includes("unauthorized")) {
    return "انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى";
  }
  if (txt.includes("network") || txt.includes("failed to fetch") || txt.includes("timeout")) {
    return "تعذر الاتصال بالخادم، تحقق من الشبكة ثم أعد المحاولة";
  }
  if (txt.includes("rate") || txt.includes("too many")) {
    return "طلبات كثيرة خلال وقت قصير، حاول بعد قليل";
  }
  return "تعذر تنفيذ الطلب الآن، يرجى المحاولة لاحقًا";
}

/**
 * @param {number} ms
 */
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {string} url
 * @param {RequestInit} init
 */
async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} name slug في المسار /functions/v1/{name} — انظر EDGE_FUNCTION_SLUGS في constants.js
 * @param {string} pathQuery مثل "" أو "?id=uuid"
 * @param {RequestInit} [init]
 */
export async function edgeFetch(name, pathQuery = "", init = {}) {
  const { supabaseUrl, supabaseAnonKey, useEdgeFunctions } = getConfig();
  if (!useEdgeFunctions) {
    throw new Error("edgeFetch: useEdgeFunctions false — استخدم واجهة الجداول المباشرة");
  }
  const token = await getAccessToken();
  if (!token) throw new Error("يجب تسجيل الدخول أولاً");

  const url = `${supabaseUrl}/functions/v1/${name}${pathQuery}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    apikey: supabaseAnonKey,
    "Content-Type": "application/json",
    ...init.headers,
  };

  const method = String(init.method || "GET").toUpperCase();
  const canRetry = method === "GET";
  let attempt = 0;
  while (attempt < (canRetry ? 2 : 1)) {
    try {
      const res = await fetchWithTimeout(url, { ...init, headers });
      const text = await res.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = { raw: text };
      }
      if (!res.ok) {
        const rawMsg = body?.error || body?.message || res.statusText || "Request failed";
        if (canRetry && RETRY_STATUS.has(res.status) && attempt === 0) {
          attempt += 1;
          await wait(RETRY_DELAY_MS);
          continue;
        }
        throw new Error(toSafeErrorMessage(rawMsg));
      }
      return body;
    } catch (err) {
      if (canRetry && attempt === 0) {
        attempt += 1;
        await wait(RETRY_DELAY_MS);
        continue;
      }
      if (err instanceof Error) {
        throw new Error(toSafeErrorMessage(err.message));
      }
      throw new Error("تعذر تنفيذ الطلب الآن، يرجى المحاولة لاحقًا");
    }
  }
  throw new Error("تعذر تنفيذ الطلب الآن، يرجى المحاولة لاحقًا");
}

/**
 * Direct table access (same RLS as Edge). Used when useEdgeFunctions is false.
 */
export function tableClient() {
  return getSupabase();
}
