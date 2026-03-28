import { formatCurrency, formatDate } from "../utils/helpers.js";
import { TX_CATEGORIES, ROUTES, currencyShortLabel } from "../utils/constants.js";
import { downloadTransferExcel, openTransferPrintPdf } from "../utils/exportTransfer.js";

function txEmoji(cat) {
  return TX_CATEGORIES.find((c) => c.id === cat)?.emoji ?? "✨";
}

/**
 * @param {HTMLElement} root
 * @param {string} transactionId
 * @param {{
 *   getState: Function,
 *   subscribe: Function,
 *   navigate: Function,
 *   onDeleteExpense: (id: string) => Promise<void>,
 *   onDeleteTransaction: (id: string) => Promise<void>,
 * }} api
 */
export function mountTransactionDetail(root, transactionId, api) {
  root.innerHTML = `
    <div class="space-y-6" data-detail>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <button type="button" data-back class="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/5">
          ← العودة للحوالات
        </button>
        <div class="flex flex-wrap gap-2">
          <button type="button" data-export-xlsx class="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20">
            تصدير Excel
          </button>
          <button type="button" data-export-pdf class="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10">
            PDF (طباعة)
          </button>
        </div>
      </div>
      <div data-main class="rounded-2xl border border-white/10 bg-white/[0.03] p-6"></div>
      <div data-expenses-section></div>
    </div>
  `;

  const backBtn = root.querySelector("[data-back]");
  const elMain = root.querySelector("[data-main]");
  const elEx = root.querySelector("[data-expenses-section]");

  const render = () => {
    const st = api.getState();
    const tx = st.transactions.find((t) => t.id === transactionId);
    if (!tx) {
      elMain.innerHTML = `
        <p class="text-rose-300">الحوالة غير موجودة في القائمة المحمّلة.</p>
        <button type="button" data-back2 class="mt-4 rounded-xl bg-white/10 px-4 py-2 text-sm">العودة</button>
      `;
      elMain.querySelector("[data-back2]")?.addEventListener("click", () => api.navigate(ROUTES.TRANSACTIONS));
      elEx.innerHTML = "";
      return;
    }

    const cur = tx.currency || "SAR";
    const short = currencyShortLabel(cur);
    const linked = st.expenses.filter((e) => e.transaction_id === transactionId);
    const sumEx = linked.reduce((s, e) => s + Number(e.amount), 0);
    const amountTx = Number(tx.amount);
    const remaining = amountTx - sumEx;

    elMain.innerHTML = `
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p class="text-xs uppercase tracking-widest text-cyan-400/80">تفاصيل الحوالة</p>
          <h1 class="mt-2 text-2xl font-black text-white">${txEmoji(tx.category)} ${escape(tx.sender)} → ${escape(tx.beneficiary)}</h1>
          <p class="mt-2 text-sm text-white/45">${formatDate(tx.transaction_date)} · ${escape(tx.category ?? "")}</p>
        </div>
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 text-center">
            <p class="text-[10px] uppercase text-white/40">مبلغ الحوالة (${short})</p>
            <p class="mt-1 font-mono text-lg font-bold text-cyan-100">${formatCurrency(amountTx, cur)}</p>
          </div>
          <div class="rounded-xl border border-violet-400/25 bg-violet-500/10 px-4 py-3 text-center">
            <p class="text-[10px] uppercase text-white/40">إجمالي المصروفات</p>
            <p class="mt-1 font-mono text-lg font-bold text-violet-100">${formatCurrency(sumEx, cur)}</p>
          </div> 
          <div class="rounded-xl border border-violet-400/25 bg-violet-500/10 px-4 py-3 text-center">
            <p class="text-[10px] uppercase ">المتبقي</p>
            <p class="mt-1 font-mono text-lg font-bold text-violet-100">${formatCurrency(remaining, cur)}</p>
          </div>
        </div>
      </div>
      <div class="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-6">
        <button type="button" data-add-ex class="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/20 hover:bg-violet-400">
          + إضافة مصروف لهذه الحوالة
        </button>
        <button type="button" data-del-tx class="rounded-xl border border-rose-400/40 px-4 py-2.5 text-sm text-rose-200 hover:bg-rose-500/15">
          حذف الحوالة
        </button>
      </div>
    `;

    elEx.innerHTML = `
      <h2 class="mb-3 text-sm font-bold uppercase tracking-widest text-white/40">المصروفات المرتبطة (${linked.length})</h2>
      <div class="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
        <table class="min-w-full text-right text-sm">
          <thead class="border-b border-white/10 text-xs uppercase text-white/40">
            <tr>
              <th class="px-4 py-3">الوصف</th>
              <th class="px-4 py-3">المبلغ</th>
              <th class="px-4 py-3">التاريخ</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody data-ex-tbody></tbody>
        </table>
      </div>
    `;

    const tbody = elEx.querySelector("[data-ex-tbody]");
    tbody.innerHTML = linked.length
      ? linked
          .map(
            (e) => `
      <tr class="border-b border-white/5 transition hover:bg-white/[0.04]">
        <td class="px-4 py-3 text-white/90">${escape(e.description)}</td>
        <td class="px-4 py-3 font-mono text-violet-200">${formatCurrency(Number(e.amount), cur)}</td>
        <td class="px-4 py-3 text-white/45">${formatDate(e.expense_date)}</td>
        <td class="px-4 py-3">
          <button type="button" data-del-ex="${e.id}" class="rounded-lg px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10">حذف</button>
        </td>
      </tr>`,
          )
          .join("")
      : `<tr><td colspan="4" class="px-4 py-8 text-center text-white/35">لا توجد مصروفات بعد — أضف مصروفاً</td></tr>`;

    tbody.querySelectorAll("[data-del-ex]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del-ex");
        if (!id || !confirm("حذف المصروف؟")) return;
        await api.onDeleteExpense(id);
      });
    });

    elMain.querySelector("[data-add-ex]")?.addEventListener("click", () => {
      api.navigate(`${ROUTES.ADD_EXPENSE}?transaction_id=${transactionId}`);
    });
    elMain.querySelector("[data-del-tx]")?.addEventListener("click", async () => {
      if (!confirm("حذف الحوالة وجميع مصروفاتها المرتبطة؟")) return;
      await api.onDeleteTransaction(transactionId);
      api.navigate(ROUTES.TRANSACTIONS);
    });
  };

  function escape(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  root.querySelector("[data-export-xlsx]")?.addEventListener("click", async () => {
    const st = api.getState();
    const tx = st.transactions.find((t) => t.id === transactionId);
    if (!tx) return;
    const linked = st.expenses.filter((e) => e.transaction_id === transactionId);
    try {
      await downloadTransferExcel(tx, linked);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "فشل التصدير");
    }
  });

  root.querySelector("[data-export-pdf]")?.addEventListener("click", () => {
    const st = api.getState();
    const tx = st.transactions.find((t) => t.id === transactionId);
    if (!tx) return;
    const linked = st.expenses.filter((e) => e.transaction_id === transactionId);
    openTransferPrintPdf(tx, linked);
  });

  backBtn.addEventListener("click", () => api.navigate(ROUTES.TRANSACTIONS));

  const unsub = [
    api.subscribe("transactions", render),
    api.subscribe("expenses", render),
    api.subscribe("realtime", render),
  ];
  render();

  return () => {
    unsub.forEach((u) => u());
    root.innerHTML = "";
  };
}
