import { fieldHTML, showFormMessage, getFormData } from "../components/form.js";
import { validateExpense } from "../utils/validators.js";
import { todayISODate, formatMoneyShort } from "../utils/helpers.js";
import { EX_CATEGORIES, ROUTES, currencyShortLabel } from "../utils/constants.js";

/**
 * @param {HTMLElement} root
 * @param {{
 *   onSubmit: Function,
 *   getTransactions: () => any[],
 *   defaultTransactionId: string,
 *   subscribe?: Function,
 *   navigate?: Function,
 * }} api
 */
export function mountAddExpense(root, api) {
  const cats = EX_CATEGORIES.map(
    (c) => `<option value="${c.id}">${c.emoji} ${c.label}</option>`,
  ).join("");

  function escape(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function txLabel(t) {
    const cur = t.currency || "SAR";
    const short = currencyShortLabel(cur);
    const amt = formatMoneyShort(Number(t.amount), cur, short);
    return `${t.sender} → ${t.beneficiary} — ${amt}`;
  }

  function buildFormHTML() {
    const txs = api.getTransactions() ?? [];
    const opts = txs
      .map((t) => {
        const sel = t.id === api.defaultTransactionId ? " selected" : "";
        return `<option value="${t.id}"${sel}>${escape(txLabel(t))}</option>`;
      })
      .join("");

    return `
    <div class="mx-auto max-w-lg space-y-6">
      <header>
        <p class="text-xs uppercase tracking-widest text-violet-400/80">إضافة مصروف</p>
        <h1 class="mt-1 text-3xl font-bold text-white">⟡ مصروف جديد</h1>
        <p class="mt-2 text-sm text-white/45">كل مصروف مرتبط بحوالة — اختر الحوالة أو أبقِ الحالية</p>
      </header>
      <form id="ex-form" class="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
        <label class="block" for="transaction_id">
          <span class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/50">الحوالة *</span>
          <select id="transaction_id" name="transaction_id" required class="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-violet-400/40 focus:ring-2 focus:ring-violet-400/30">
            ${opts || '<option value="">— لا حوالات —</option>'}
          </select>
        </label>
        <p class="text-xs text-white/40" data-cur-hint>العملة بحسب الحوالة المختارة</p>
        ${fieldHTML({ id: "description", label: "الوصف", required: true, placeholder: "مثال:تحويل راتب " })}
        ${fieldHTML({ id: "amount", label: "المبلغ", type: "number", step: "0.01", required: true })}
        ${fieldHTML({ id: "expense_date", label: "التاريخ", type: "date", value: todayISODate(), required: true })}
        <label class="block" for="category">
          <span class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/50">التصنيف</span>
          <select id="category" name="category" class="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-violet-400/40 focus:ring-2 focus:ring-violet-400/30">
            ${cats}
          </select>
        </label>
        <button type="submit" class="w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 hover:brightness-110">
          حفظ المصروف
        </button>
      </form>
    </div>
  `;
  }

  function syncCurrencyHint() {
    const form = root.querySelector("#ex-form");
    if (!form) return;
    const sel = /** @type {HTMLSelectElement} */ (form.querySelector("#transaction_id"));
    const hint = form.querySelector("[data-cur-hint]");
    const txs = api.getTransactions() ?? [];
    const tx = txs.find((t) => t.id === sel?.value);
    if (hint && tx) {
      hint.textContent = `العملة المرتبطة بالحوالة: ${currencyShortLabel(tx.currency || "SAR")}`;
    }
  }

  function mountInner() {
    const txs = api.getTransactions() ?? [];
    if (!txs.length) {
      root.innerHTML = `
        <div class="mx-auto max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p class="text-white/80">لا توجد حوالات — أضف حوالة أولاً لربط مصروف بها.</p>
          <button type="button" data-go-tx class="mt-4 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-zinc-950">+ حوالة جديدة</button>
        </div>
      `;
      root.querySelector("[data-go-tx]")?.addEventListener("click", () => {
        api.navigate?.(ROUTES.ADD_TRANSACTION);
      });
      return;
    }

    root.innerHTML = buildFormHTML();
    const form = /** @type {HTMLFormElement} */ (root.querySelector("#ex-form"));
    if (!form) return;

    const txSel = form.querySelector("#transaction_id");
    txSel?.addEventListener("change", syncCurrencyHint);
    syncCurrencyHint();

    const submitBtn = /** @type {HTMLButtonElement | null} */ (form.querySelector('button[type="submit"]'));
    const submitLabel = submitBtn?.textContent?.trim() || "حفظ المصروف";
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const raw = getFormData(form);
      const payload = {
        transaction_id: raw.transaction_id,
        description: raw.description,
        amount: Number(raw.amount),
        expense_date: raw.expense_date,
        category: raw.category || "general",
      };
      const errs = validateExpense(payload);
      if (errs.length) {
        showFormMessage(form, errs.join(" — "), "error");
        return;
      }
      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "جاري الحفظ…";
        }
        await api.onSubmit(payload);
        showFormMessage(form, "تم الحفظ بنجاح ✓", "ok");
        form.reset();
        const d = form.querySelector("#expense_date");
        if (d) /** @type {HTMLInputElement} */ (d).value = todayISODate();
        const ts = form.querySelector("#transaction_id");
        if (ts && api.defaultTransactionId) {
          /** @type {HTMLSelectElement} */ (ts).value = api.defaultTransactionId;
        }
        syncCurrencyHint();
      } catch (err) {
        showFormMessage(form, err instanceof Error ? err.message : "فشل الحفظ", "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitLabel;
        }
      }
    });
  }

  mountInner();

  let removeTxSub = () => {};
  if (typeof api.subscribe === "function") {
    removeTxSub = api.subscribe("transactions", () => {
      const txs = api.getTransactions() ?? [];
      const currentForm = root.querySelector("#ex-form");
      let preserve = api.defaultTransactionId;
      if (currentForm) {
        const v = /** @type {HTMLSelectElement} */ (currentForm.querySelector("#transaction_id"))?.value;
        if (v) preserve = v;
      }
      mountInner();
      const sel = /** @type {HTMLSelectElement} */ (root.querySelector("#transaction_id"));
      if (sel && preserve && txs.some((t) => t.id === preserve)) sel.value = preserve;
      syncCurrencyHint();
    });
  }

  return () => {
    removeTxSub();
    root.innerHTML = "";
  };
}
