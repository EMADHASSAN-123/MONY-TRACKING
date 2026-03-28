import { edgeFetch } from "./apiClient.js";
import { getSupabase } from "./supabaseClient.js";
import { EDGE_FUNCTION_SLUGS, getConfig } from "../utils/constants.js";

const REPORT_CACHE_TTL_MS = 20000;
/** @type {Map<string, { at: number, value: any }>} */
const reportCache = new Map();
/** @type {Map<string, Promise<any>>} */
const inFlight = new Map();

function useEdge() {
  return getConfig().useEdgeFunctions;
}

/**
 * @param {"day"|"week"|"month"|"all"} range
 */
export async function fetchReport(range = "month") {
  const key = String(range);
  const now = Date.now();
  const cached = reportCache.get(key);
  if (cached && now - cached.at < REPORT_CACHE_TTL_MS) {
    return cached.value;
  }
  const pending = inFlight.get(key);
  if (pending) return pending;

  const run = (async () => {
    const value = useEdge()
      ? await edgeFetch(EDGE_FUNCTION_SLUGS.REPORTS, `?range=${encodeURIComponent(range)}`, { method: "GET" })
      : await computeReportClient(range);
    reportCache.set(key, { at: Date.now(), value });
    return value;
  })();
  inFlight.set(key, run);
  if (useEdge()) {
    try {
      return await run;
    } finally {
      inFlight.delete(key);
    }
  }
  try {
    return await run;
  } finally {
    inFlight.delete(key);
  }
}

/**
 * @param {ReturnType<typeof computeReportClient>} rep
 * @param {string} currency
 */
export function sliceReportForCurrency(rep, currency) {
  if (!rep?.byCurrency || !currency) return rep;
  const slice = rep.byCurrency[currency];
  if (!slice) return rep;
  return {
    ...rep,
    summary: slice.summary,
    series: slice.series,
  };
}

/**
 * Client-side aggregation (متوافق مع Edge reports) عند تعطيل الدوال.
 * @param {"day"|"week"|"month"|"all"} range
 */
async function computeReportClient(range) {
  const sb = getSupabase();
  const now = new Date();
  const toDate = now.toISOString().slice(0, 10);
  let fromDate = null;

  if (range === "day") {
    fromDate = toDate;
  } else if (range === "week") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    fromDate = start.toISOString().slice(0, 10);
  } else if (range === "month") {
    fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  }

  let txQ = sb.from("transactions").select("amount, transaction_date, created_at, currency");
  let exQ = sb.from("expenses").select("amount, expense_date, created_at, currency");
  if (fromDate) {
    txQ = txQ.gte("transaction_date", fromDate).lte("transaction_date", toDate);
    exQ = exQ.gte("expense_date", fromDate).lte("expense_date", toDate);
  }

  const [{ data: transactions, error: e1 }, { data: expenses, error: e2 }] = await Promise.all([
    txQ,
    exQ,
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const txs = transactions ?? [];
  const exs = expenses ?? [];
  const curSet = new Set(); /** @type {Set<string>} */
  for (const r of txs) curSet.add(r.currency || "SAR");
  for (const r of exs) curSet.add(r.currency || "SAR");
  const currencies = [...curSet].sort();

  /** @type {Record<string, { summary: object, series: object[] }>} */
  const byCurrency = {};
  for (const c of currencies) {
    const txsC = txs.filter((r) => (r.currency || "SAR") === c);
    const exsC = exs.filter((r) => (r.currency || "SAR") === c);
    const txSum = txsC.reduce((s, r) => s + Number(r.amount), 0);
    const exSum = exsC.reduce((s, r) => s + Number(r.amount), 0);
    const byDayTx = {};
    const byDayEx = {};
    for (const r of txsC) {
      const k = r.transaction_date;
      byDayTx[k] = (byDayTx[k] ?? 0) + Number(r.amount);
    }
    for (const r of exsC) {
      const k = r.expense_date;
      byDayEx[k] = (byDayEx[k] ?? 0) + Number(r.amount);
    }
    const days = new Set([...Object.keys(byDayTx), ...Object.keys(byDayEx)]);
    const series = [...days].sort().map((d) => ({
      date: d,
      transfers: byDayTx[d] ?? 0,
      expenses: byDayEx[d] ?? 0,
    }));
    byCurrency[c] = {
      summary: {
        totalTransferVolume: txSum,
        totalExpenses: exSum,
        netFlow: txSum - exSum,
        transactionCount: txsC.length,
        expenseCount: exsC.length,
      },
      series,
    };
  }

  const primary = currencies[0] ?? "SAR";
  const primarySlice = byCurrency[primary] ?? {
    summary: {
      totalTransferVolume: 0,
      totalExpenses: 0,
      netFlow: 0,
      transactionCount: 0,
      expenseCount: 0,
    },
    series: [],
  };

  return {
    range,
    fromDate,
    toDate,
    currencies,
    byCurrency,
    summary: primarySlice.summary,
    series: primarySlice.series,
    multiCurrency: currencies.length > 1,
  };
}
