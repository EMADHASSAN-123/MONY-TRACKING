/**
 * أسماء Edge Functions في المسار: {supabaseUrl}/functions/v1/{slug}
 * يجب أن تطابق الاسم عند الإنشاء في لوحة Supabase (أو عند deploy).
 * ملفات جاهزة للنسخ: supabase/browser-paste/*.ts (المهام: انسخ من supabase/functions/tasks/index.ts)
 */
export const EDGE_FUNCTION_SLUGS = {
  TRANSACTIONS: "transactions",
  EXPENSES: "expenses",
  REPORTS: "reports",
  ADMIN_USERS: "admin-users",
  TASKS: "tasks",
};

/** @returns {{ supabaseUrl: string, supabaseAnonKey: string, useEdgeFunctions: boolean }} */
export function getConfig() {
  const c = globalThis.MONY_CONFIG;
  return {
    supabaseUrl: (c?.supabaseUrl ?? "").replace(/\/$/, ""),
    supabaseAnonKey: c?.supabaseAnonKey ?? "",
    useEdgeFunctions: c?.useEdgeFunctions !== false,
  };
}

export const ROUTES = {
  DASHBOARD: "/",
  ADD_TRANSACTION: "/add-transaction",
  ADD_EXPENSE: "/add-expense",
  TRANSACTIONS: "/transactions",
  EXPENSES: "/expenses",
  REPORTS: "/reports",
  TASKS: "/tasks",
  ADMIN_USERS: "/admin-users",
};

/** بادئة مسار تفاصيل الحوالة: #/transactions/{uuid} */
export const TRANSACTION_DETAIL_PREFIX = "/transactions/";

/** بادئة مسار تفاصيل المهمة: #/tasks/{uuid} */
export const TASK_DETAIL_PREFIX = "/tasks/";

/** @type {{ id: string, labelAr: string, labelShort: string }[]} */
export const APP_CURRENCIES = [
  { id: "SAR", labelAr: "ريال سعودي", labelShort: "ر.س" },
  { id: "YER", labelAr: "ريال يمني", labelShort: "ر.ي" },
  { id: "AED", labelAr: "درهم إماراتي", labelShort: "د" },
];

/** @param {string|undefined|null} code */
export function currencyMeta(code) {
  const c = String(code || "SAR").toUpperCase();
  return APP_CURRENCIES.find((x) => x.id === c) ?? APP_CURRENCIES[0];
}

/** @param {string|undefined|null} code */
export function currencyShortLabel(code) {
  return currencyMeta(code).labelShort;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** @param {string} s */
export function isUuid(s) {
  return UUID_RE.test(String(s || "").trim());
}

/**
 * @param {string} path مثلاً /transactions/uuid
 * @returns {string|null}
 */
export function matchTransactionDetailPath(path) {
  const p = path.startsWith(TRANSACTION_DETAIL_PREFIX) ? path.slice(TRANSACTION_DETAIL_PREFIX.length) : "";
  if (!p.includes("/") && isUuid(p)) return p;
  return null;
}

/**
 * @param {string} path
 * @returns {string|null}
 */
export function matchTaskDetailPath(path) {
  const p = path.startsWith(TASK_DETAIL_PREFIX) ? path.slice(TASK_DETAIL_PREFIX.length) : "";
  if (!p.includes("/") && isUuid(p)) return p;
  return null;
} 

export const ROUTE_LABELS = {
  [ROUTES.DASHBOARD]: { title: "لوحة التحكم", titleEn: "Dashboard", icon: "◈" },
  [ROUTES.ADD_TRANSACTION]: { title: "حوالة جديدة", titleEn: "New transfer", icon: "⟰" },
  [ROUTES.ADD_EXPENSE]: { title: "مصروف جديد", titleEn: "New expense", icon: "⟡" },
  [ROUTES.TRANSACTIONS]: { title: "الحوالات", titleEn: "Transfers", icon: "⧉" },
  [ROUTES.EXPENSES]: { title: "المصروفات", titleEn: "Expenses", icon: "⧈" },
  [ROUTES.TASKS]: { title: "المهام", titleEn: "Tasks", icon: "✦" },
  [ROUTES.REPORTS]: { title: "التقارير", titleEn: "Reports", icon: "⟣" },
  [ROUTES.ADMIN_USERS]: { title: "المستخدمون", titleEn: "Users", icon: "⛭" },
};

export const TX_CATEGORIES = [
  { id: "family", label: "عائلي", emoji: "👨‍👩‍👧" },
  { id: "business", label: "عمل", emoji: "💼" },
  { id: "urgent", label: "عاجل", emoji: "⚡" },
  { id: "general", label: "عام", emoji: "✨" },
];

export const EX_CATEGORIES = [
  { id: "food", label: "طعام", emoji: "🍽️" },
  { id: "transport", label: "مواصلات", emoji: "🚗" },
  { id: "bills", label: "فواتير", emoji: "📄" },
  { id: "general", label: "عام", emoji: "✨" },
];

/** Widgets in the draggable grid (quick + pulse stay fixed above). */
export const DASHBOARD_WIDGETS = ["spiral", "timeline"];

export const STORAGE_KEYS = {
  dashboardLayout: "mony-dashboard-layout",
};

/** @param {string|undefined|null} role */
export function isStaffRole(role) {
  return role === "admin" || role === "manager";
}

/** @param {string|undefined|null} role */
export function isAdminRole(role) {
  return role === "admin";
}
