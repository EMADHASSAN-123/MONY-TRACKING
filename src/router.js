import { ROUTES, matchTransactionDetailPath, matchTaskDetailPath } from "./utils/constants.js";

/** معاملات الاستعلام بعد # (مثل ?transaction_id=) */
export function getHashSearchParams() {
  const h = (location.hash || "").replace(/^#/, "");
  const q = h.includes("?") ? h.slice(h.indexOf("?") + 1) : "";
  return new URLSearchParams(q);
}

function normalize(hash) {
  const h = (hash || "#/").replace(/^#/, "") || "/";
  if (!h.startsWith("/")) return "/" + h;
  return h.split("?")[0];
}

export function getRoute() {
  return normalize(location.hash);
}

/** @type {Set<(path: string) => void>} */
const subs = new Set();

export function navigate(path) {
  const p = path.startsWith("#") ? path.slice(1) : path;
  const next = p.startsWith("/") ? "#" + p : "#/" + p;
  if (location.hash === next) {
    subs.forEach((fn) => fn(getRoute()));
    return;
  }
  location.hash = next;
}

export function startRouter(onChange) {
  const handler = () => onChange(getRoute());
  window.addEventListener("hashchange", handler);
  return () => window.removeEventListener("hashchange", handler);
}

/**
 * Subscribe to route changes without hashchange (programmatic refresh).
 * @param {(path: string) => void} fn
 */
export function subscribeRoute(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function pathToLabel(path) {
  if (matchTaskDetailPath(path)) return "تفاصيل مهمة";
  if (matchTransactionDetailPath(path)) return "تفاصيل حوالة";
  const map = {
    [ROUTES.DASHBOARD]: "Dashboard",
    [ROUTES.ADD_TRANSACTION]: "حوالة",
    [ROUTES.ADD_EXPENSE]: "مصروف",
    [ROUTES.TRANSACTIONS]: "الحوالات",
    [ROUTES.EXPENSES]: "المصروفات",
    [ROUTES.REPORTS]: "التقارير",
    [ROUTES.TASKS]: "المهام",
    [ROUTES.ADMIN_USERS]: "المستخدمون",
  };
  return map[path] ?? path;
}
