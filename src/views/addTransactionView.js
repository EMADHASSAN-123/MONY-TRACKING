import { fieldHTML, showFormMessage, getFormData } from "../components/form.js";
import { validateTransaction } from "../utils/validators.js";
import { todayISODate } from "../utils/helpers.js";
import { TX_CATEGORIES, APP_CURRENCIES } from "../utils/constants.js";

/**
 * @param {HTMLElement} root
 * @param {{ onSubmit: Function, navigate: Function }} api
 */
export function mountAddTransaction(root, api) {
  const cats = TX_CATEGORIES.map(
    (c) => `<option value="${c.id}">${c.emoji} ${c.label}</option>`,
  ).join("");
  const curOpts = APP_CURRENCIES.map(
    (c) => `<option value="${c.id}">${c.labelShort} — ${c.labelAr}</option>`,
  ).join("");

  root.innerHTML = `
    <div class="mx-auto max-w-lg space-y-6">
      <header>
        <p class="text-xs uppercase tracking-widest text-cyan-400/80">إنشاء حوالة</p>
        <h1 class="mt-1 text-3xl font-bold text-white">⟰ حوالة جديدة</h1>
      </header>
      <form id="tx-form" class="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
        ${fieldHTML({ id: "sender", label: "المرسل", required: true, placeholder: "اسم المرسل" })}
        ${fieldHTML({ id: "beneficiary", label: "المستفيد", required: true, placeholder: "اسم المستفيد" })}
        ${fieldHTML({ id: "amount", label: "المبلغ", type: "number", step: "0.01", required: true, placeholder: "0.00" })}
        ${fieldHTML({ id: "transaction_date", label: "التاريخ", type: "date", value: todayISODate(), required: true })}
        <label class="block" for="currency">
          <span class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/50">العملة</span>
          <select id="currency" name="currency" class="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/30">
            ${curOpts}
          </select>
        </label>
        <label class="block" for="category">
          <span class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/50">التصنيف</span>
          <select id="category" name="category" class="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/30">
            ${cats}
          </select>
        </label>
        <button type="submit" class="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 py-3 text-sm font-bold text-zinc-950 shadow-lg shadow-cyan-500/25 hover:brightness-110">
          حفظ الحوالة
        </button>
      </form>
    </div>
  `;

  const form = /** @type {HTMLFormElement} */ (root.querySelector("#tx-form"));
  const submitBtn = /** @type {HTMLButtonElement | null} */ (form.querySelector('button[type="submit"]'));
  const submitLabel = submitBtn?.textContent?.trim() || "حفظ الحوالة";
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const raw = getFormData(form);
    const payload = {
      sender: raw.sender,
      beneficiary: raw.beneficiary,
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
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "جاري الحفظ…";
      }
      await api.onSubmit(payload);
      showFormMessage(form, "تم الحفظ بنجاح ✓", "ok");
      form.reset();
      const d = form.querySelector("#transaction_date");
      if (d) d.value = todayISODate();
    } catch (err) {
      showFormMessage(form, err instanceof Error ? err.message : "فشل الحفظ", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitLabel;
      }
    }
  });

  return () => {
    root.innerHTML = "";
  };
}
