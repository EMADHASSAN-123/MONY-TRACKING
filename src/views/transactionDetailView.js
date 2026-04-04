import { formatCurrency, formatDate } from "../utils/helpers.js";
import {
  TX_CATEGORIES,
  EX_CATEGORIES,
  ROUTES,
  APP_CURRENCIES,
  currencyShortLabel,
} from "../utils/constants.js";
import { downloadTransferExcel, openTransferPrintPdf } from "../utils/exportTransfer.js";
import { fieldHTML, getFormData, showFormMessage } from "../components/form.js";
import { validateTransaction, validateExpense } from "../utils/validators.js";
import { createModalShell } from "../components/modal.js";
import { confirmDialog } from "../components/confirmDialog.js";
import { iconPencil, iconTrash, btnIconEdit, btnIconDelete } from "../components/icons.js";

function txEmoji(cat) {
  return TX_CATEGORIES.find((c) => c.id === cat)?.emoji ?? "✨";
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * @param {HTMLElement} shell
 */
function showModal(shell) {
  document.body.appendChild(shell);
  requestAnimationFrame(() => {
    shell.classList.remove("opacity-0", "pointer-events-none");
    shell.classList.add("opacity-100");
  });
}

/**
 * @param {HTMLElement} shell
 */
function hideModal(shell) {
  shell.classList.add("opacity-0", "pointer-events-none");
  shell.classList.remove("opacity-100");
  setTimeout(() => shell.remove(), 200);
}

/**
 * @param {HTMLElement} shell
 * @param {() => void} onClose
 */
function wireModalClose(shell, onClose) {
  shell.querySelector("[data-close]")?.addEventListener("click", onClose);
  shell.addEventListener("click", (e) => {
    if (e.target === shell) onClose();
  });
}

/**
 * @param {string} transactionId
 * @param {{
 *   getState: Function,
 *   onPatchTransaction: (id: string, patch: Record<string, unknown>) => Promise<unknown>,
 * }} api
 */
function openEditTransactionModal(transactionId, api) {
  const tx = api.getState().transactions.find((t) => t.id === transactionId);
  if (!tx) return;

  const modalId = "mony-edit-tx-modal";
  document.getElementById(modalId)?.remove();

  const catsOpts = TX_CATEGORIES.map((c) => {
    const sel = String(tx.category || "general") === c.id ? " selected" : "";
    return `<option value="${escapeAttr(c.id)}"${sel}>${c.emoji} ${escapeAttr(c.label)}</option>`;
  }).join("");

  const curVal = tx.currency || "SAR";
  const curOpts = APP_CURRENCIES.map((c) => {
    const sel = c.id === curVal ? " selected" : "";
    return `<option value="${escapeAttr(c.id)}"${sel}>${escapeAttr(c.labelShort)} — ${escapeAttr(c.labelAr)}</option>`;
  }).join("");

  const html = `
    <form id="edit-tx-form" class="space-y-3">
      ${fieldHTML({
        id: "sender",
        label: "المرسل",
        required: true,
        value: escapeAttr(tx.sender),
        placeholder: "اسم المرسل",
      })}
      ${fieldHTML({
        id: "beneficiary",
        label: "المستفيد",
        required: true,
        value: escapeAttr(tx.beneficiary),
        placeholder: "اسم المستفيد",
      })}
      ${fieldHTML({
        id: "amount",
        label: "المبلغ",
        type: "number",
        step: "0.01",
        required: true,
        value: escapeAttr(String(tx.amount)),
      })}
      ${fieldHTML({
        id: "transaction_date",
        label: "التاريخ",
        type: "date",
        required: true,
        value: escapeAttr(tx.transaction_date),
      })}
      <label class="block" for="currency">
        <span class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/50">العملة</span>
        <select id="currency" name="currency" class="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/30">
          ${curOpts}
        </select>
      </label>
      <label class="block" for="category">
        <span class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/50">التصنيف</span>
        <select id="category" name="category" class="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/30">
          ${catsOpts}
        </select>
      </label>
      <button type="submit" class="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 py-3 text-sm font-bold text-zinc-950 shadow-lg shadow-cyan-500/25 hover:brightness-110">
        حفظ التعديلات
      </button> 
    </form>
  `;

  const shell = createModalShell({ id: modalId, title: "تعديل الحوالة", contentHTML: html });
  const close = () => hideModal(shell);
  wireModalClose(shell, close);
  showModal(shell);

  const form = /** @type {HTMLFormElement} */ (shell.querySelector("#edit-tx-form"));
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = /** @type {HTMLButtonElement | null} */ (form.querySelector('button[type="submit"]'));
    const label = btn?.textContent?.trim() || "حفظ التعديلات";
    const raw = getFormData(form);
    const payload = {
      sender: raw.sender.trim(),
      beneficiary: raw.beneficiary.trim(),
      amount: Number(raw.amount),
      transaction_date: raw.transaction_date,
      category: raw.category || "general",
      currency: raw.currency || "SAR",
    };
    const errs = validateTransaction(payload);
    if (errs.length) {
      showFormMessage(form, errs.join(" — "), "error");
      return;
    }
    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = "جاري الحفظ…";
      }
      await api.onPatchTransaction(transactionId, payload);
      hideModal(shell);
    } catch (err) {
      showFormMessage(form, err instanceof Error ? err.message : "فشل الحفظ", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = label;
      }
    }
  });
}

/**
 * @param {string} transactionId
 * @param {string} expenseId
 * @param {{
 *   getState: Function,
 *   onPatchExpense: (id: string, patch: Record<string, unknown>) => Promise<unknown>,
 * }} api
 */
function openEditExpenseModal(transactionId, expenseId, api) {
  const ex = api.getState().expenses.find((x) => x.id === expenseId);
  if (!ex || ex.transaction_id !== transactionId) return;

  const modalId = "mony-edit-ex-modal";
  document.getElementById(modalId)?.remove();

  const catsOpts = EX_CATEGORIES.map((c) => {
    const sel = String(ex.category || "general") === c.id ? " selected" : "";
    return `<option value="${escapeAttr(c.id)}"${sel}>${escapeAttr(c.label)}</option>`;
  }).join("");

  const html = `
    <form id="edit-ex-form" class="space-y-3">
      ${fieldHTML({
        id: "description",
        label: "الوصف",
        required: true,
        value: escapeAttr(ex.description),
        placeholder: "وصف المصروف",
      })}
      ${fieldHTML({
        id: "amount",
        label: "المبلغ",
        type: "number",
        step: "0.01",
        required: true,
        value: escapeAttr(String(ex.amount)),
      })}
      ${fieldHTML({
        id: "expense_date",
        label: "التاريخ",
        type: "date",
        required: true,
        value: escapeAttr(ex.expense_date),
      })}
      <label class="block" for="category">
        <span class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/50">التصنيف</span>
        <select id="category" name="category" class="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-violet-400/40 focus:ring-2 focus:ring-violet-400/30">
          ${catsOpts}
        </select>
      </label>
      <button type="submit" class="w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 hover:brightness-110">
        حفظ التعديلات
      </button>
    </form>
  `;

  const shell = createModalShell({ id: modalId, title: "تعديل المصروف", contentHTML: html });
  wireModalClose(shell, () => hideModal(shell));
  showModal(shell);

  const form = /** @type {HTMLFormElement} */ (shell.querySelector("#edit-ex-form"));
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = /** @type {HTMLButtonElement | null} */ (form.querySelector('button[type="submit"]'));
    const label = btn?.textContent?.trim() || "حفظ التعديلات";
    const raw = getFormData(form);
    const payload = {
      description: raw.description.trim(),
      amount: Number(raw.amount),
      expense_date: raw.expense_date,
      category: raw.category || "general",
      transaction_id: transactionId,
    };
    const errs = validateExpense(payload);
    if (errs.length) {
      showFormMessage(form, errs.join(" — "), "error");
      return;
    }
    const patch = {
      description: payload.description,
      amount: payload.amount,
      expense_date: payload.expense_date,
      category: payload.category,
    };
    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = "جاري الحفظ…";
      }
      await api.onPatchExpense(expenseId, patch);
      hideModal(shell);
    } catch (err) {
      showFormMessage(form, err instanceof Error ? err.message : "فشل الحفظ", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = label;
      }
    }
  });
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
 *   onPatchTransaction: (id: string, patch: Record<string, unknown>) => Promise<unknown>,
 *   onPatchExpense: (id: string, patch: Record<string, unknown>) => Promise<unknown>,
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
          <h1 class="mt-2 text-2xl font-black text-white">${txEmoji(tx.category)} ${escapeHtml(tx.sender)} → ${escapeHtml(tx.beneficiary)}</h1>
          <p class="mt-2 text-sm text-white/45">${formatDate(tx.transaction_date)} · ${escapeHtml(tx.category ?? "")}</p>
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
      <div class="mt-6 flex flex-wrap gap-2 border-t border-white/[0.08] pt-6">
        <button type="button" data-edit-tx class="inline-flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/[0.1] px-4 py-2.5 text-sm font-medium text-sky-100/95 transition hover:border-sky-400/45 hover:bg-sky-500/[0.16]">
          ${iconPencil}<span>تعديل الحوالة</span>
        </button>
        <button type="button" data-add-ex class="rounded-xl bg-violet-600/88 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-900/30 transition hover:bg-violet-500/90">
          + إضافة مصروف
        </button>
        <button type="button" data-del-tx class="inline-flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/[0.1] px-4 py-2.5 text-sm font-medium text-rose-100/90 transition hover:border-rose-400/45 hover:bg-rose-500/[0.16]">
          ${iconTrash}<span>حذف الحوالة</span>
        </button>
      </div>
    `;

    elEx.innerHTML = `
      <h2 class="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/42">المصروفات المرتبطة (${linked.length})</h2>
      <div class="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.025] shadow-sm ring-1 ring-white/[0.04]">
        <table class="min-w-full text-right text-sm">
          <thead class="border-b border-white/[0.08] bg-white/[0.04] text-[11px] font-semibold uppercase tracking-wider text-white/45">
            <tr>
              <th class="px-4 py-3.5 font-medium">الوصف</th>
              <th class="px-4 py-3.5 font-medium">المبلغ</th>
              <th class="px-4 py-3.5 font-medium">التاريخ</th>
              <th class="w-[1%] px-3 py-3.5 text-center font-medium text-white/40">إجراءات</th>
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
      <tr class="border-b border-white/[0.06] transition-colors last:border-0 hover:bg-violet-500/[0.05]">
        <td class="max-w-[16rem] px-4 py-3.5 align-middle text-white/88">${escapeHtml(e.description)}</td>
        <td class="whitespace-nowrap px-4 py-3.5 align-middle font-mono text-sm text-violet-200/95">${formatCurrency(Number(e.amount), cur)}</td>
        <td class="whitespace-nowrap px-4 py-3.5 align-middle text-white/48">${formatDate(e.expense_date)}</td>
        <td class="px-2 py-3 align-middle text-center">
          <div class="inline-flex items-center justify-center gap-1" role="group" aria-label="إجراءات">
            <button type="button" data-edit-ex="${e.id}" class="${btnIconEdit}" title="تعديل" aria-label="تعديل المصروف">${iconPencil}</button>
            <button type="button" data-del-ex="${e.id}" class="${btnIconDelete}" title="حذف" aria-label="حذف المصروف">${iconTrash}</button>
          </div>
        </td>
      </tr>`,
          )
          .join("")
      : `<tr><td colspan="4" class="px-4 py-10 text-center text-sm text-white/38">لا توجد مصروفات بعد — أضف مصروفاً</td></tr>`;

    tbody.querySelectorAll("[data-del-ex]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del-ex");
        if (!id) return;
        const ok = await confirmDialog({
          title: "حذف المصروف؟",
          message: "هل أنت متأكد من حذف هذا المصروف؟ لا يمكن التراجع.",
          confirmLabel: "حذف نهائياً",
          cancelLabel: "إلغاء",
          danger: true,
        });
        if (!ok) return;
        await api.onDeleteExpense(id);
      });
    });

    tbody.querySelectorAll("[data-edit-ex]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-edit-ex");
        if (id) openEditExpenseModal(transactionId, id, api);
      });
    });

    elMain.querySelector("[data-edit-tx]")?.addEventListener("click", () => {
      openEditTransactionModal(transactionId, api);
    });

    elMain.querySelector("[data-add-ex]")?.addEventListener("click", () => {
      api.navigate(`${ROUTES.ADD_EXPENSE}?transaction_id=${transactionId}`);
    });
    elMain.querySelector("[data-del-tx]")?.addEventListener("click", async () => {
      const ok = await confirmDialog({
        title: "حذف الحوالة؟",
        message: "سيتم حذف الحوالة وجميع المصروفات المرتبطة بها. لا يمكن التراجع عن هذا الإجراء.",
        confirmLabel: "حذف نهائياً",
        cancelLabel: "إلغاء",
        danger: true,
      });
      if (!ok) return;
      await api.onDeleteTransaction(transactionId);
      api.navigate(ROUTES.TRANSACTIONS);
    });
  };

  function escapeHtml(s) {
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
    document.getElementById("mony-edit-tx-modal")?.remove();
    document.getElementById("mony-edit-ex-modal")?.remove();
    unsub.forEach((u) => u());
    root.innerHTML = "";
  };
}
