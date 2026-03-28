import { formatCurrency, formatDate } from "../utils/helpers.js";
import {
  ROUTES,
  TX_CATEGORIES,
  EX_CATEGORIES,
  STORAGE_KEYS,
  DASHBOARD_WIDGETS,
  currencyShortLabel,
  isStaffRole,
} from "../utils/constants.js";
import { cardHTML } from "../components/card.js";
import { pulseHighlight } from "../components/card.js";

function categoryEmoji(kind, id) {
  const list = kind === "tx" ? TX_CATEGORIES : EX_CATEGORIES;
  return list.find((c) => c.id === id)?.emoji ?? "✨";
}

/**
 * @param {{ amount: unknown, currency?: string }[]} rows
 */
function sumByCurrency(rows) {
  /** @type {Record<string, number>} */
  const m = {};
  for (const r of rows) {
    const c = r.currency || "SAR";
    m[c] = (m[c] ?? 0) + Number(r.amount);
  }
  return m;
}

function readLayout() {
  const valid = new Set(DASHBOARD_WIDGETS);
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.dashboardLayout);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      const filtered = parsed.filter((id) => valid.has(id));
      if (filtered.length) return filtered;
    }
  } catch {
    /* ignore */
  }
  return [...DASHBOARD_WIDGETS];
}

function saveLayout(order) {
  localStorage.setItem(STORAGE_KEYS.dashboardLayout, JSON.stringify(order));
}

/**
 * @param {ReturnType<import('../state.js').getState>} st
 */
function spiralHTML(st) {
  const txBy = sumByCurrency(st.transactions);
  const exBy = sumByCurrency(st.expenses);
  const currencies = [...new Set([...Object.keys(txBy), ...Object.keys(exBy)])].sort();

  if (currencies.length <= 1) {
    const c = currencies[0] ?? "SAR";
    const tx = txBy[c] ?? 0;
    const ex = exBy[c] ?? 0;
    const total = tx + ex || 1;
    const txDeg = (tx / total) * 360;
    const exDeg = 360 - txDeg;
    const short = currencyShortLabel(c);
    return `
    <div class="relative flex aspect-square max-w-[280px] items-center justify-center">
      <div class="absolute inset-0 rounded-full border border-white/10 shadow-inner shadow-black/50" style="
        background: conic-gradient(from -90deg, rgb(var(--mony-cyan-rgb)) ${txDeg}deg, rgb(var(--mony-violet-rgb)) ${txDeg}deg ${txDeg + exDeg}deg);
      "></div>
      <div class="relative z-10 flex h-[72%] w-[72%] flex-col items-center justify-center rounded-full bg-zinc-950/90 p-4 text-center ring-1 ring-white/10">
        <p class="text-[10px] uppercase tracking-[0.2em] text-white/40">Spiral · ${short}</p>
        <p class="mt-2 text-lg font-bold text-white">حوالات vs مصروفات</p>
        <p class="mt-1 text-xs text-cyan-300/90">📤 ${formatCurrency(tx, c)}</p>
        <p class="text-xs text-violet-300/90">💸 ${formatCurrency(ex, c)}</p>
      </div>
    </div>
  `;
  }

  const lines = currencies
    .map((c) => {
      const tx = txBy[c] ?? 0;
      const ex = exBy[c] ?? 0;
      const short = currencyShortLabel(c);
      return `<p class="text-xs text-white/80">${short}: 📤 ${formatCurrency(tx, c)} · 💸 ${formatCurrency(ex, c)}</p>`;
    })
    .join("");
  return `
    <div class="relative flex min-h-[200px] max-w-[280px] flex-col items-center justify-center rounded-full border border-white/10 bg-zinc-950/90 p-6 text-center ring-1 ring-white/10">
      <p class="text-[10px] uppercase tracking-[0.2em] text-white/40">عدة عملات</p>
      <p class="mt-2 text-sm font-bold text-white">إجماليات منفصلة</p>
      <div class="mt-4 space-y-1 text-start">${lines}</div>
    </div>
  `;
}

/**
 * @param {ReturnType<import('../state.js').getState>} st
 */
function timelineHTML(st) {
  const merged = [
    ...st.transactions.map((t) => ({
      kind: "tx",
      id: t.id,
      title: `${t.sender} → ${t.beneficiary}`,
      amount: Number(t.amount),
      date: t.transaction_date,
      cat: t.category,
      currency: t.currency || "SAR",
    })),
    ...st.expenses.map((e) => ({
      kind: "ex",
      id: e.id,
      title: e.description,
      amount: Number(e.amount),
      date: e.expense_date,
      cat: e.category,
      currency: e.currency || "SAR",
    })),
  ]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)))
    .slice(0, 14);

  if (!merged.length) {
    return `<p class="py-8 text-center text-sm text-white/40">لا توجد عمليات بعد — ابدأ بإضافة حوالة أو مصروف</p>`;
  }

  return `
    <ol class="relative border-s border-white/10 ms-3 space-y-6 py-2 ps-8">
      ${merged
        .map(
          (m, i) => `
        <li class="animate-fadeSlide" style="animation-delay:${i * 40}ms">
          <span class="absolute -start-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border border-white/20 ${
            m.kind === "tx"
              ? "bg-cyan-400 shadow-[0_0_12px_rgba(var(--mony-cyan-rgb),0.5)]"
              : "bg-violet-400 shadow-[0_0_12px_rgba(var(--mony-violet-rgb),0.45)]"
          }"></span>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-sm text-white/90">${categoryEmoji(m.kind, m.cat)} ${escape(m.title)}</span>
            <span class="font-mono text-sm ${m.kind === "tx" ? "text-cyan-200" : "text-violet-200"}">${formatCurrency(m.amount, m.currency)}</span>
          </div>
          <p class="mt-1 text-xs text-white/35">${formatDate(m.date)}</p>
        </li>
      `,
        )
        .join("")}
    </ol>
  `;
}

function escape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * @param {any} report
 * @param {ReturnType<import('../state.js').getState>} st
 */
function quickCards(report, st) {
  const s = report?.summary;
  const txC = st.transactions.length;
  const exC = st.expenses.length;
  const uid = st.sessionUser?.id;
  const taskList = st.tasks ?? [];
  const openTask = (t) => !["completed", "cancelled"].includes(String(t.status));
  const myOpenCount = uid ? taskList.filter((t) => t.assigned_to === uid && openTask(t)).length : 0;
  const allOpenCount = taskList.filter(openTask).length;
  const taskSubtitle = isStaffRole(st.profile?.role)
    ? `${allOpenCount} نشطة إجمالاً · ${myOpenCount} مكلف بك`
    : `${myOpenCount} مهمة نشطة لك`;

  return `
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
      ${cardHTML({
        title: "حجم الحوالات (الفترة)",
        subtitle: report?.multiCurrency ? "أول عملة في التقرير — انظر التقارير للتفصيل" : (report?.range ?? "—"),
        accent: "from-cyan-600/25 to-transparent",
        body: `<p class="text-2xl font-bold text-cyan-200" data-metric="tx-vol">${formatCurrency(s?.totalTransferVolume ?? 0, report?.currencies?.[0] ?? "SAR")}</p>`,
      })}
      ${cardHTML({
        title: "إجمالي المصروفات",
        subtitle: report?.multiCurrency ? "نفس العملة أعلاه" : "ضمن نفس الفترة",
        accent: "from-violet-600/25 to-transparent",
        body: `<p class="text-2xl font-bold text-violet-200" data-metric="ex-sum">${formatCurrency(s?.totalExpenses ?? 0, report?.currencies?.[0] ?? "SAR")}</p>`,
      })}
      ${cardHTML({
        title: "تدفق صافٍ",
        subtitle: "حوالات − مصروفات",
        accent: "from-emerald-600/20 to-transparent",
        body: `<p class="text-2xl font-bold text-emerald-200" data-metric="net">${formatCurrency(s?.netFlow ?? 0, report?.currencies?.[0] ?? "SAR")}</p><p class="mt-2 text-xs text-white/40">${txC} حوالة · ${exC} مصروف</p>`,
      })}
      ${cardHTML({
        title: "المهام",
        subtitle: taskSubtitle,
        accent: "from-fuchsia-600/25 to-transparent",
        body: `<p class="text-xs text-white/55">تعيين المهام وتتبع السجل — للمدير والمسؤول وللمكلفين</p>
          <button type="button" data-go="${ROUTES.TASKS}" class="mt-4 w-full rounded-xl bg-fuchsia-500/20 px-3 py-2.5 text-sm font-semibold text-fuchsia-100 ring-1 ring-fuchsia-400/30 hover:bg-fuchsia-500/30">فتح صفحة المهام</button>`,
      })}
    </div>
  `;
}

function pulseBlock(st, report) {
  const s = report?.summary;
  return `
    <div data-pulse-card class="rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 via-zinc-900/80 to-violet-500/10 p-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-widest text-white/40">Live pulse</p>
          <p class="mt-1 text-3xl font-black text-white">${formatCurrency((s?.totalTransferVolume ?? 0) + (s?.totalExpenses ?? 0), report?.currencies?.[0] ?? "SAR")}</p>
          <p class="text-sm text-white/45">مجموع الحركة المالية في الفترة</p>
        </div>
        <div class="flex gap-2 text-2xl opacity-80">📈 💹 ✨</div>
      </div>
    </div>
  `;
}

function widgetShell(id, title, inner) {
  return `
    <div draggable="true" data-widget="${id}" class="dashboard-widget cursor-grab rounded-2xl border border-white/5 bg-white/[0.03] p-4 ring-1 ring-white/5 transition hover:ring-cyan-400/20 active:cursor-grabbing">
      <div class="mb-3 flex items-center justify-between gap-2">
        <h3 class="text-xs font-bold uppercase tracking-widest text-white/45">${title}</h3>
        <span class="text-white/25">⋮⋮</span>
      </div>
      ${inner}
    </div>
  `;
}

/**
 * @param {HTMLElement} root
 * @param {{ subscribe: Function, getState: Function, navigate: Function }} api
 */
export function mountDashboard(root, api) {
  let order = readLayout();
  root.innerHTML = `
    <div class="space-y-8">
      <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs font-medium uppercase tracking-[0.25em] text-cyan-400/80">الادارة المالية</p>
          <h1 class="mt-1 text-3xl font-black text-white sm:text-4xl">لوحة تحكم مالية حية</h1>
          <p class="mt-2 max-w-xl text-sm text-white/50">Spiral · Timeline · Realtime — اسحب البطاقات لإعادة الترتيب</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" data-go="${ROUTES.ADD_TRANSACTION}" class="rounded-xl bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100 ring-1 ring-cyan-400/30 hover:bg-cyan-500/30">+ حوالة</button>
          <button type="button" data-go="${ROUTES.TRANSACTIONS}" class="rounded-xl bg-violet-500/20 px-4 py-2 text-sm font-semibold text-violet-100 ring-1 ring-violet-400/30 hover:bg-violet-500/30" title="اختر حوالة ثم أضف مصروفاً">+ مصروف ← حوالة</button>
          <button type="button" data-go="${ROUTES.TASKS}" class="rounded-xl bg-fuchsia-500/20 px-4 py-2 text-sm font-semibold text-fuchsia-100 ring-1 ring-fuchsia-400/30 hover:bg-fuchsia-500/30">✦ المهام</button>
        </div>
      </header>
      <div data-quick></div>
      <div data-pulse-wrap></div>
      <div data-widgets class="grid gap-6 lg:grid-cols-2"></div>
    </div>
  `;

  const elQuick = root.querySelector("[data-quick]");
  const elPulse = root.querySelector("[data-pulse-wrap]");
  const elWidgets = root.querySelector("[data-widgets]");

  const render = () => {
    const st = api.getState();
    elQuick.innerHTML = quickCards(st.report, st);
    elPulse.innerHTML = pulseBlock(st, st.report);

    const blocks = {
      spiral: widgetShell("spiral", "Radial / Spiral", spiralHTML(st)),
      timeline: widgetShell("timeline", "Timeline flow", timelineHTML(st)),
    };
    elWidgets.innerHTML = order
      .filter((id) => blocks[id])
      .map((id) => blocks[id])
      .join("");
  };

  const unsub = [
    api.subscribe("transactions", render),
    api.subscribe("expenses", render),
    api.subscribe("tasks", render),
    api.subscribe("report", render),
    api.subscribe("loading", render),
    api.subscribe("profile", render),
  ];

  /** @param {MouseEvent} e */
  const onClickGo = (e) => {
    const btn = e.target.closest("[data-go]");
    if (!btn || !root.contains(btn)) return;
    const path = btn.getAttribute("data-go");
    if (path) api.navigate(path);
  };
  root.addEventListener("click", onClickGo);

  render();

  /** @type {string|null} */
  let dragId = null;
  elWidgets.addEventListener("dragstart", (e) => {
    const t = e.target.closest("[data-widget]");
    if (!t) return;
    dragId = t.getAttribute("data-widget");
    e.dataTransfer?.setData("text/plain", dragId || "");
  });
  elWidgets.addEventListener("dragover", (e) => e.preventDefault());
  elWidgets.addEventListener("drop", (e) => {
    e.preventDefault();
    const target = e.target.closest("[data-widget]");
    const dropId = target?.getAttribute("data-widget");
    if (!dragId || !dropId || dragId === dropId) return;
    const o = [...order];
    const i = o.indexOf(dragId);
    const j = o.indexOf(dropId);
    if (i < 0 || j < 0) return;
    o.splice(i, 1);
    o.splice(j, 0, dragId);
    saveLayout(o);
    order.length = 0;
    order.push(...o);
    render();
    dragId = null;
  });

  const pulseEl = () => root.querySelector("[data-pulse-card]");
  const rtUnsub = api.subscribe("realtime", () => {
    const p = pulseEl();
    if (p) pulseHighlight(p);
  });

  return () => {
    root.removeEventListener("click", onClickGo);
    unsub.forEach((u) => u());
    rtUnsub();
    root.innerHTML = "";
  };
}
