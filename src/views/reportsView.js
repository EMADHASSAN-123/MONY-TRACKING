import { formatCurrency, formatDate } from "../utils/helpers.js";
import { currencyShortLabel } from "../utils/constants.js";

/**
 * @param {HTMLElement} root
 * @param {{ getState: Function, subscribe: Function, refresh: Function }} api
 */
export function mountReports(root, api) {
  root.innerHTML = `
    <div class="space-y-8">
      <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs uppercase tracking-widest text-emerald-400/80">التقارير</p>
          <h1 class="text-3xl font-bold text-white">⟣ تحليلات ورسوم</h1>
        </div>
        <div class="flex flex-wrap gap-2" data-range-btns>
          ${["day", "week", "month", "all"]
            .map(
              (r) => `
            <button type="button" data-range="${r}" class="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 hover:border-emerald-400/40 hover:text-white">
              ${r === "day" ? "يوم" : r === "week" ? "أسبوع" : r === "month" ? "شهر" : "الكل"}
            </button>
          `,
            )
            .join("")}
        </div>
      </header>
      <div data-summary class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"></div>
      <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 class="mb-1 text-sm font-bold uppercase tracking-widest text-white/40">مقارنة يومية</h2>
        <p class="mb-4 text-xs text-white/35" data-chart-hint></p>
        <div data-chart class="flex h-56 items-end gap-1 overflow-x-auto pb-2"></div>
      </div>
      <div data-table-mobile class="space-y-3 lg:hidden" aria-label="جدول التقارير (موبايل)"></div>
      <div data-table class="hidden lg:block overflow-x-auto rounded-2xl border border-white/10"></div>
    </div>
  `;

  const elSum = root.querySelector("[data-summary]");
  const elChart = root.querySelector("[data-chart]");
  const elTable = root.querySelector("[data-table]");
  const elTableMobile = root.querySelector("[data-table-mobile]");

  const render = () => {
    const st = api.getState();
    const rep = st.report;
    const range = st.reportRange || "month";
    root.querySelectorAll("[data-range-btns] [data-range]").forEach((b) => {
      const r = b.getAttribute("data-range");
      const on = r === range;
      b.classList.toggle("ring-2", on);
      b.classList.toggle("ring-emerald-400/50", on);
      b.classList.toggle("bg-emerald-500/15", on);
    });

    const curList = rep?.currencies?.length ? rep.currencies : Object.keys(rep?.byCurrency ?? {});
    const primaryCur = curList[0] ?? "SAR";

    if (rep?.multiCurrency && curList.length > 1) {
      elSum.innerHTML = curList
        .map((c) => {
          const s = rep.byCurrency?.[c]?.summary;
          const short = currencyShortLabel(c);
          return `
        <div class="col-span-full rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4 sm:col-span-2 lg:col-span-4">
          <p class="text-xs font-bold uppercase tracking-wider text-emerald-300/90">${short} (${c})</p>
          <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><p class="text-[10px] uppercase text-white/40">حجم الحوالات</p><p class="mt-1 text-lg font-bold text-cyan-200">${formatCurrency(s?.totalTransferVolume ?? 0, c)}</p></div>
            <div><p class="text-[10px] uppercase text-white/40">المصروفات</p><p class="mt-1 text-lg font-bold text-violet-200">${formatCurrency(s?.totalExpenses ?? 0, c)}</p></div>
            <div><p class="text-[10px] uppercase text-white/40">صافي التدفق</p><p class="mt-1 text-lg font-bold text-emerald-200">${formatCurrency(s?.netFlow ?? 0, c)}</p></div>
            <div><p class="text-[10px] uppercase text-white/40">السجلات</p><p class="mt-1 text-lg font-bold text-white/80">${s?.transactionCount ?? 0} / ${s?.expenseCount ?? 0}</p></div>
          </div>
        </div>`;
        })
        .join("");
    } else {
      const s = rep?.summary;
      elSum.innerHTML = [
        {
          k: "حجم الحوالات",
          v: formatCurrency(s?.totalTransferVolume ?? 0, primaryCur),
          c: "text-cyan-200",
        },
        {
          k: "المصروفات",
          v: formatCurrency(s?.totalExpenses ?? 0, primaryCur),
          c: "text-violet-200",
        },
        { k: "صافي التدفق", v: formatCurrency(s?.netFlow ?? 0, primaryCur), c: "text-emerald-200" },
        { k: "عدد السجلات", v: `${s?.transactionCount ?? 0} / ${s?.expenseCount ?? 0}`, c: "text-white/80" },
      ]
        .map(
          (x) => `
      <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-4">
        <p class="text-xs uppercase text-white/40">${x.k}</p>
        <p class="mt-2 text-xl font-bold ${x.c}">${x.v}</p>
      </div>
    `,
        )
        .join("");
    }

    const hint = root.querySelector("[data-chart-hint]");
    if (hint) {
      hint.textContent = rep?.multiCurrency
        ? `الرسم التالي لعملة ${currencyShortLabel(primaryCur)} (${primaryCur}) — الجداول تستخدم نفس العملة.`
        : "";
    }

    const series = rep?.series ?? [];
    const maxVal = Math.max(1, ...series.map((p) => Math.max(p.transfers, p.expenses)));
    elChart.innerHTML = series
      .map((p) => {
        const h1 = Math.round((p.transfers / maxVal) * 100);
        const h2 = Math.round((p.expenses / maxVal) * 100);
        return `
        <div class="flex min-w-[14px] flex-1 flex-col items-center justify-end gap-1" title="${p.date}">
          <div class="flex w-full max-w-[20px] flex-col justify-end gap-0.5" style="height:200px">
            <div class="w-full rounded-t bg-cyan-400/80" style="height:${h1}%"></div>
            <div class="w-full rounded-b bg-violet-400/80" style="height:${h2}%"></div>
          </div>
          <span class="mt-1 rotate-45 text-[8px] text-white/30">${p.date.slice(5)}</span>
        </div>
      `;
      })
      .join("");

    if (elTableMobile) {
      elTableMobile.innerHTML = series
        .map(
          (p) => `
        <div class="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div class="flex items-center justify-between gap-3">
            <div class="text-xs text-white/60">${formatDate(p.date)}</div>
            <div class="text-[10px] text-white/35">الحوالات/المصروفات</div>
          </div>
          <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div class="font-mono text-cyan-200">${formatCurrency(p.transfers, primaryCur)}</div>
            <div class="font-mono text-violet-200">${formatCurrency(p.expenses, primaryCur)}</div>
          </div>
        </div>
      `,
        )
        .join("");
    }

    elTable.innerHTML = `
      <table class="min-w-full text-right text-sm">
        <thead class="border-b border-white/10 text-xs uppercase text-white/40">
          <tr><th class="px-4 py-3">التاريخ</th><th class="px-4 py-3">حوالات</th><th class="px-4 py-3">مصروفات</th></tr>
        </thead>
        <tbody>
          ${series
            .map(
              (p) => `
            <tr class="border-b border-white/5">
              <td class="px-4 py-2 text-white/60">${formatDate(p.date)}</td>
              <td class="px-4 py-2 font-mono text-cyan-200">${formatCurrency(p.transfers, primaryCur)}</td>
              <td class="px-4 py-2 font-mono text-violet-200">${formatCurrency(p.expenses, primaryCur)}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    `;
  };

  root.querySelectorAll("[data-range-btns] [data-range]").forEach((b) => {
    b.addEventListener("click", async () => {
      const r = b.getAttribute("data-range");
      if (r) await api.refresh(r);
    });
  });

  const unsub = [api.subscribe("report", render), api.subscribe("reportRange", render), api.subscribe("loading", render)];
  render();

  return () => {
    unsub.forEach((u) => u());
    root.innerHTML = "";
  };
}
