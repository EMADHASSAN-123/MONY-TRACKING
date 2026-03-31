import * as txApi from "./api/transactions.js";
import * as exApi from "./api/expenses.js";
import * as repApi from "./api/reports.js";
import * as tasksApi from "./api/tasks.js";
import { getSupabase } from "./api/supabaseClient.js";
import { enqueueJob, readQueue, removeJobById } from "./offline/syncQueue.js";

/** @typedef {{ id: string, sender: string, beneficiary: string, amount: number|string, transaction_date: string, category?: string, currency?: string, created_at?: string, user_id?: string }} Transaction */
/** @typedef {{ id: string, description: string, amount: number|string, expense_date: string, category?: string, transaction_id: string, currency?: string, created_at?: string, user_id?: string }} Expense */
/** @typedef {{ id: string, title: string, description?: string, priority?: string, status?: string, due_at?: string|null, created_by: string, assigned_to: string, created_at?: string, updated_at?: string }} Task */

/** @type {Transaction[]} */
let transactions = [];
/** @type {Expense[]} */
let expenses = [];
/** @type {Task[]} */
let tasks = [];
/** @type {Record<string, any>} */
let reportCache = {
  month: null,
  week: null,
  day: null,
  all: null,
};

let reportRange = "month";
let sessionUser = null;
/** @type {{ id: string, role: string, full_name?: string } | null} */
let profile = null;
let loading = { boot: true, tx: false, ex: false, rep: false, tasks: false };
let errorMessage = "";
/** @type {Promise<any> | null} */
let inFlightReportPromise = null;

/** @type {Map<string, Set<Function>>} */
const bus = new Map();

/**
 * @param {string} event
 * @param {Function} fn
 */
export function subscribe(event, fn) {
  if (!bus.has(event)) bus.set(event, new Set());
  bus.get(event).add(fn);
  return () => bus.get(event)?.delete(fn);
}

function emit(event, payload) {
  bus.get(event)?.forEach((fn) => fn(payload));
}

export function getState() {
  return {
    transactions,
    expenses,
    tasks,
    report: reportCache[reportRange],
    reportRange,
    sessionUser,
    profile,
    loading: { ...loading },
    errorMessage,
  };
}

export async function refreshProfile() {
  if (!sessionUser) {
    profile = null;
    emit("profile", profile);
    return;
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", sessionUser.id)
    .single();
  if (error) {
    profile = null;
    emit("profile", profile);
    return;
  }
  profile = data;
  emit("profile", profile);
}

function setError(msg) {
  errorMessage = msg || "";
  emit("error", errorMessage);
}

/**
 * @param {{ silent?: boolean, skipReportRefresh?: boolean }} [options]
 */
export async function refreshTransactions(options = {}) {
  const { silent = false, skipReportRefresh = false } = options;
  loading.tx = true;
  if (!silent) emit("loading", loading);
  try {
    transactions = await txApi.fetchTransactions();
    emit("transactions", transactions);
    if (!skipReportRefresh) await refreshReportsQuiet();
  } catch (e) {
    setError(e instanceof Error ? e.message : "فشل تحميل الحوالات");
  } finally {
    loading.tx = false;
    if (!silent) emit("loading", loading);
  }
}

/**
 * @param {{ silent?: boolean, skipReportRefresh?: boolean }} [options]
 */
export async function refreshExpenses(options = {}) {
  const { silent = false, skipReportRefresh = false } = options;
  loading.ex = true;
  if (!silent) emit("loading", loading);
  try {
    expenses = await exApi.fetchExpenses();
    emit("expenses", expenses);
    if (!skipReportRefresh) await refreshReportsQuiet();
  } catch (e) {
    setError(e instanceof Error ? e.message : "فشل تحميل المصروفات");
  } finally {
    loading.ex = false;
    if (!silent) emit("loading", loading);
  }
}

async function refreshReportsQuiet() {
  if (inFlightReportPromise) return inFlightReportPromise;
  inFlightReportPromise = (async () => {
    try {
      reportCache[reportRange] = await repApi.fetchReport(/** @type {*} */ (reportRange));
      emit("report", reportCache[reportRange]);
    } catch {
      /* ignore background report errors */
    }
  })();
  try {
    await inFlightReportPromise;
  } finally {
    inFlightReportPromise = null;
  }
}

/**
 * @param {{ silent?: boolean }} [options]
 */
export async function refreshTasks(options = {}) {
  const { silent = false } = options;
  loading.tasks = true;
  if (!silent) emit("loading", loading);
  try {
    tasks = await tasksApi.fetchTasks();
    emit("tasks", tasks);
  } catch (e) {
    setError(e instanceof Error ? e.message : "فشل تحميل المهام");
  } finally {
    loading.tasks = false;
    if (!silent) emit("loading", loading);
  }
}

export async function refreshReports(range = reportRange) {
  reportRange = range;
  emit("reportRange", range);
  loading.rep = true;
  emit("loading", loading);
  try {
    reportCache[range] = await repApi.fetchReport(/** @type {*} */ (range));
    emit("report", reportCache[range]);
  } catch (e) {
    setError(e instanceof Error ? e.message : "فشل التقرير");
  } finally {
    loading.rep = false;
    emit("loading", loading);
  }
}

/** @param {Transaction} row */
function upsertTx(row) {
  const i = transactions.findIndex((t) => t.id === row.id);
  if (i >= 0) transactions[i] = row;
  else transactions = [row, ...transactions];
  emit("transactions", transactions);
}

/** @param {string} id */
function removeTx(id) {
  transactions = transactions.filter((t) => t.id !== id);
  emit("transactions", transactions);
}

/** @param {Expense} row */
function upsertEx(row) {
  const i = expenses.findIndex((t) => t.id === row.id);
  if (i >= 0) expenses[i] = row;
  else expenses = [row, ...expenses];
  emit("expenses", expenses);
}

/** @param {string} id */
function removeEx(id) {
  expenses = expenses.filter((t) => t.id !== id);
  emit("expenses", expenses);
}

/** @param {Task} row */
function upsertTask(row) {
  const i = tasks.findIndex((t) => t.id === row.id);
  if (i >= 0) tasks[i] = row;
  else tasks = [row, ...tasks];
  emit("tasks", tasks);
}

/** @param {string} id */
function removeTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  emit("tasks", tasks);
}

let realtimeChannel = null;
let syncingOfflineQueue = false;

export function teardownRealtime() {
  if (realtimeChannel) {
    getSupabase().removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

export function setupRealtime() {
  teardownRealtime();
  const sb = getSupabase();
  realtimeChannel = sb
    .channel("mony-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "transactions" },
      async (payload) => {
        if (payload.eventType === "DELETE") {
          removeTx(payload.old.id);
        } else if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          upsertTx(/** @type {*} */ (payload.new));
        }
        await refreshReportsQuiet();
        emit("realtime", { table: "transactions", payload });
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "expenses" },
      async (payload) => {
        if (payload.eventType === "DELETE") {
          removeEx(payload.old.id);
        } else if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          upsertEx(/** @type {*} */ (payload.new));
        }
        await refreshReportsQuiet();
        emit("realtime", { table: "expenses", payload });
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tasks" },
      (payload) => {
        if (payload.eventType === "DELETE") {
          removeTask(payload.old.id);
        } else if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          upsertTask(/** @type {*} */ (payload.new));
        }
        emit("realtime", { table: "tasks", payload });
      },
    )
    .subscribe();
}

export async function bootState() {
  loading.boot = true;
  emit("loading", loading);
  const sb = getSupabase();
  const { data } = await sb.auth.getSession();
  sessionUser = data.session?.user ?? null;

  sb.auth.onAuthStateChange(async (event, session) => {
    sessionUser = session?.user ?? null;
    if (event === "INITIAL_SESSION") return;
    if (sessionUser) {
      await loadAllForUser();
      setupRealtime();
    } else {
      teardownRealtime();
      transactions = [];
      expenses = [];
      tasks = [];
      profile = null;
      reportCache = { month: null, week: null, day: null, all: null };
      emit("transactions", transactions);
      emit("expenses", expenses);
      emit("tasks", tasks);
      emit("report", null);
      emit("profile", null);
    }
    emit("auth", sessionUser);
  });

  if (sessionUser) {
    await loadAllForUser();
    setupRealtime();
    setupOfflineSync();
  }
  loading.boot = false;
  emit("loading", loading);
  emit("auth", sessionUser);
}

function setupOfflineSync() {
  window.addEventListener("online", () => {
    processOfflineQueue().catch(() => {});
  });
  // Try at startup in case we were offline previously.
  processOfflineQueue().catch(() => {});
}

function tempId(prefix) {
  return `tmp-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function processOfflineQueue() {
  if (!sessionUser || !navigator.onLine || syncingOfflineQueue) return;
  const jobs = readQueue();
  if (!jobs.length) return;
  syncingOfflineQueue = true;
  emit("sync", { running: true, pending: jobs.length });
  /** @type {Record<string, string>} */
  const idMap = {};
  try {
    for (const job of jobs) {
      const p = job.payload || {};
      if (job.type === "createTransaction") {
        const created = await txApi.createTransaction(/** @type {*} */ (p.row));
        if (typeof p.tempId === "string") {
          idMap[p.tempId] = created.id;
          removeTx(p.tempId);
        }
        upsertTx(created);
      } else if (job.type === "deleteTransaction") {
        const originalId = String(p.id || "");
        const realId = idMap[originalId] || originalId;
        if (realId.startsWith("tmp-")) {
          removeTx(realId);
        } else {
          await txApi.deleteTransaction(realId);
        }
      } else if (job.type === "createExpense") {
        const row = { ...(/** @type {*} */ (p.row || {})) };
        const txId = String(row.transaction_id || "");
        row.transaction_id = idMap[txId] || txId;
        const created = await exApi.createExpense(row);
        if (typeof p.tempId === "string") {
          idMap[p.tempId] = created.id;
          removeEx(p.tempId);
        }
        upsertEx(created);
      } else if (job.type === "deleteExpense") {
        const originalId = String(p.id || "");
        const realId = idMap[originalId] || originalId;
        if (realId.startsWith("tmp-")) {
          removeEx(realId);
        } else {
          await exApi.deleteExpense(realId);
        }
      }
      removeJobById(job.id);
    }
    await refreshReportsQuiet();
    emit("sync", { running: false, pending: 0, ok: true });
  } catch (e) {
    emit("sync", {
      running: false,
      pending: readQueue().length,
      ok: false,
      error: e instanceof Error ? e.message : "sync_failed",
    });
  } finally {
    syncingOfflineQueue = false;
  }
}

async function loadAllForUser() {
  setError("");
  await refreshProfile();
  await Promise.all([
    refreshTransactions({ skipReportRefresh: true, silent: true }),
    refreshExpenses({ skipReportRefresh: true, silent: true }),
    refreshTasks({ silent: true }),
  ]);
  await refreshReports(reportRange);
}

/**
 * @param {string} email
 * @param {string} password
 */
export async function signIn(email, password) {
  const sb = getSupabase();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    const msg = String(error.message || "").toLowerCase();
    if (msg.includes("invalid login credentials")) {
      throw new Error("البريد أو كلمة المرور غير صحيحة");
    }
    if (msg.includes("email not confirmed")) {
      throw new Error("يجب تأكيد البريد الإلكتروني قبل تسجيل الدخول");
    }
    throw new Error("تعذر تسجيل الدخول الآن، حاول لاحقًا");
  }
}

/**
 * @param {string} email
 * @param {string} password
 */
export async function signUp(email, password) {
  const sb = getSupabase();
  const { error } = await sb.auth.signUp({ email, password });
  if (error) {
    const msg = String(error.message || "").toLowerCase();
    if (msg.includes("already registered")) {
      throw new Error("هذا البريد مسجل مسبقًا");
    }
    if (msg.includes("password")) {
      throw new Error("كلمة المرور لا تستوفي المتطلبات");
    }
    throw new Error("تعذر إنشاء الحساب الآن، حاول لاحقًا");
  }
}

/**
 * @param {string} email
 */
export async function signInWithMagicLink(email) {
  const sb = getSupabase();
  const redirectTo = `${location.origin}${location.pathname}`;
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
  });
  if (error) {
    const msg = String(error.message || "").toLowerCase();
    if (msg.includes("rate") || msg.includes("too many")) {
      throw new Error("تم إرسال طلبات كثيرة، انتظر دقيقة ثم أعد المحاولة");
    }
    throw new Error("تعذر إرسال رابط الدخول الآن");
  }
}

export async function signOut() {
  const sb = getSupabase();
  await sb.auth.signOut();
}

/**
 * @param {Parameters<typeof txApi.createTransaction>[0]} row
 */
export async function addTransaction(row) {
  if (!navigator.onLine) {
    const tId = tempId("tx");
    const optimistic = {
      ...row,
      id: tId,
      user_id: sessionUser?.id,
      created_at: new Date().toISOString(),
      __pending: true,
    };
    enqueueJob("createTransaction", { tempId: tId, row });
    upsertTx(/** @type {*} */ (optimistic));
    await refreshReportsQuiet();
    emit("sync", { running: false, pending: readQueue().length, queued: true });
    return optimistic;
  }
  const created = await txApi.createTransaction(row);
  upsertTx(created);
  await refreshReportsQuiet();
  emit("realtime", { local: true, table: "transactions" });
  return created;
}

/**
 * @param {Parameters<typeof exApi.createExpense>[0]} row
 */
export async function addExpense(row) {
  if (!navigator.onLine) {
    const eId = tempId("ex");
    const optimistic = {
      ...row,
      id: eId,
      user_id: sessionUser?.id,
      created_at: new Date().toISOString(),
      __pending: true,
    };
    enqueueJob("createExpense", { tempId: eId, row });
    upsertEx(/** @type {*} */ (optimistic));
    await refreshReportsQuiet();
    emit("sync", { running: false, pending: readQueue().length, queued: true });
    return optimistic;
  }
  const created = await exApi.createExpense(row);
  upsertEx(created);
  await refreshReportsQuiet();
  emit("realtime", { local: true, table: "expenses" });
  return created;
}
 
/** @param {string} id */
export async function removeTransaction(id) {
  if (!navigator.onLine) {
    enqueueJob("deleteTransaction", { id });
    removeTx(id);
    await refreshReportsQuiet();
    emit("sync", { running: false, pending: readQueue().length, queued: true });
    return true;
  }
  await txApi.deleteTransaction(id);
  removeTx(id);
  await refreshReportsQuiet();
}

/** @param {string} id */
export async function removeExpense(id) {
  if (!navigator.onLine) {
    enqueueJob("deleteExpense", { id });
    removeEx(id);
    await refreshReportsQuiet();
    emit("sync", { running: false, pending: readQueue().length, queued: true });
    return true;
  }
  await exApi.deleteExpense(id);
  removeEx(id);
  await refreshReportsQuiet();
}

/**
 * @param {Parameters<typeof tasksApi.createTask>[0]} row
 */
export async function addTask(row) {
  const created = await tasksApi.createTask(row);
  upsertTask(/** @type {*} */ (created));
  emit("realtime", { local: true, table: "tasks" });
  return created;
}

/**
 * @param {string} id
 * @param {Parameters<typeof tasksApi.updateTask>[1]} patch
 */
export async function patchTask(id, patch) {
  const updated = await tasksApi.updateTask(id, patch);
  upsertTask(updated);
  emit("realtime", { local: true, table: "tasks" });
  return updated;
}

/** @param {string} id */
export async function removeTaskById(id) {
  await tasksApi.deleteTask(id);
  removeTask(id);
  emit("realtime", { local: true, table: "tasks" });
  return true;
}

