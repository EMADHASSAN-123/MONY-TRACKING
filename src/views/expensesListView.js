import { formatCurrency, formatDate } from "../utils/helpers.js";
import {
  EX_CATEGORIES,
  isStaffRole,
  TRANSACTION_DETAIL_PREFIX,
  LIST_VIEW_PAGE_STEP,
} from "../utils/constants.js";
import { iconPencil, iconTrash, btnIconEdit, btnIconDelete } from "../components/icons.js";
import { confirmDialog } from "../components/confirmDialog.js";

function emojiFor(cat) {
  return EX_CATEGORIES.find((c) => c.id === cat)?.label ?? "✨";
}

const tableWrap =
  "overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.025] shadow-sm ring-1 ring-white/[0.04]";
const theadRow =
  "border-b border-white/[0.08] bg-white/[0.04] text-[11px] font-semibold uppercase tracking-wider text-white/45";
const tbodyTr = "border-b border-white/[0.06] transition-colors hover:bg-violet-500/[0.05] last:border-0";

/**
 * @param {HTMLElement} root
 * @param {{ getState: Function, subscribe: Function, onDelete: Function, navigate: Function }} api
 */
export function mountExpensesList(root, api) {
  root.innerHTML = `
    <div class="space-y-5 sm:space-y-6">
      <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div class="space-y-1">
          <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-400/70">المصروفات</p>
          <h1 class="text-2xl font-bold text-white sm:text-3xl">⧈ المصروفات</h1>
          <p class="max-w-xl text-sm text-white/45">التعديل يفتح صفحة الحوالة المرتبطة — الحذف يتطلب تأكيداً</p>
        </div>
        <p class="shrink-0 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/50" data-count></p>
      </header>
      <div class="space-y-3 md:hidden" data-mobile-rows></div>
      <div class="hidden md:block ${tableWrap}">
        <table class="min-w-full text-right text-sm">
          <thead class="${theadRow}">
            <tr>
              <th class="px-4 py-3.5 font-medium">التصنيف</th>
              <th class="px-4 py-3.5 font-medium">الحوالة</th>
              <th class="px-4 py-3.5 font-medium">الوصف</th>
              <th class="px-4 py-3.5 font-medium">المبلغ</th>
              <th class="px-4 py-3.5 font-medium">التاريخ</th>
              <th class="hidden px-4 py-3.5 font-medium lg:table-cell" data-th-owner>المستخدم</th>
              <th class="w-[1%] whitespace-nowrap px-3 py-3.5 text-center font-medium text-white/40">إجراءات</th>
            </tr>
          </thead>
          <tbody data-rows></tbody>
        </table>
      </div>
      <div class="hidden justify-center pt-1" data-ex-more-wrap>
        <button type="button" data-ex-load-more class="rounded-xl border border-white/12 bg-white/[0.05] px-5 py-2.5 text-sm text-white/80 transition hover:border-white/18 hover:bg-white/[0.09]">
          عرض المزيد
        </button>
      </div>
    </div>
  `;

  const mobileRows = root.querySelector("[data-mobile-rows]");
  const tbody = root.querySelector("[data-rows]");
  const countEl = root.querySelector("[data-count]");
  const thOwner = root.querySelector("[data-th-owner]");
  const moreWrap = root.querySelector("[data-ex-more-wrap]");
  let visibleCount = LIST_VIEW_PAGE_STEP;

  const ac = new AbortController();
  root.addEventListener(
    "click",
    (e) => {
      const t = e.target.closest("[data-ex-load-more]");
      if (!t) return;
      e.preventDefault();
      visibleCount += LIST_VIEW_PAGE_STEP;
      render();
    },
    { signal: ac.signal },
  );

  function render() {
    const st = api.getState();
    const staff = isStaffRole(st.profile?.role);
    if (thOwner) {
      thOwner.classList.toggle("hidden", !staff);
      thOwner.classList.toggle("table-cell", staff);
    }
    const all = st.expenses;
    const rows = all.slice(0, visibleCount);
    const rest = all.length - rows.length;
    countEl.textContent =
      all.length <= visibleCount
        ? `${all.length} مصروف`
        : `${rows.length} من ${all.length}`;
    if (moreWrap) {
      const showMore = rest > 0;
      moreWrap.classList.toggle("hidden", !showMore);
      moreWrap.classList.toggle("flex", showMore);
      const btn = moreWrap.querySelector("[data-ex-load-more]");
      if (btn) btn.textContent = `عرض المزيد (${Math.min(LIST_VIEW_PAGE_STEP, rest)} · ${rest} متبقي)`;
    }

    if (mobileRows) {
      mobileRows.innerHTML = rows
        .map((t) => {
          const tx = st.transactions.find((x) => x.id === t.transaction_id);
          const cur = t.currency || tx?.currency || "SAR";
          const txLabel = tx ? `${tx.sender} → ${tx.beneficiary}` : "—";
          const txId = t.transaction_id || "";
          return `
          <article class="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 shadow-sm ring-1 ring-white/[0.04]">
            <div class="flex items-start justify-between gap-3">
              <span class="text-xl leading-none">${emojiFor(t.category)}</span>
              <div class="shrink-0 text-left">
                <div class="text-[11px] text-white/45">${formatDate(t.expense_date)}</div>
                <div class="mt-1 font-mono text-sm text-violet-200/95">${formatCurrency(t.amount, cur)}</div>
              </div>
            </div>
            <p class="mt-3 text-sm font-medium leading-relaxed text-white/88">${escape(t.description)}</p>
            <div class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
              <div class="min-w-0 flex-1">
                <span class="text-[10px] text-white/35">الحوالة</span>
                ${
                  tx
                    ? `<button type="button" data-open-tx="${tx.id}" class="mt-0.5 block max-w-full truncate text-start text-xs text-cyan-200/85 transition hover:text-cyan-100 hover:underline">${escape(txLabel)}</button>`
                    : `<span class="text-white/30">—</span>`
                }
              </div>
              <div class="flex items-center gap-1" role="group" aria-label="إجراءات">
                <button type="button" data-ex-edit="${txId}" class="${btnIconEdit} ${!txId ? "pointer-events-none opacity-35" : ""}" title="تعديل من صفحة الحوالة" aria-label="تعديل المصروف">${iconPencil}</button>
                <button type="button" data-ex-del="${t.id}" class="${btnIconDelete}" title="حذف المصروف" aria-label="حذف المصروف">${iconTrash}</button>
              </div>
            </div>
            <div class="mt-2 text-[10px] text-white/30 ${staff ? "" : "hidden"}">${staff && t.user_id ? `مستخدم: ${escape(String(t.user_id).slice(0, 8))}…` : ""}</div>
          </article>
        `;
        })
        .join("");
    }

    if (tbody) {
      tbody.innerHTML = rows
        .map((t) => {
          const tx = st.transactions.find((x) => x.id === t.transaction_id);
          const cur = t.currency || tx?.currency || "SAR";
          const txLabel = tx ? `${tx.sender} → ${tx.beneficiary}` : "—";
          const txId = t.transaction_id || "";
          return `
        <tr class="${tbodyTr}" data-id="${t.id}">
          <td class="px-4 py-3.5 align-middle text-base">${emojiFor(t.category)}</td>
          <td class="max-w-[12rem] px-4 py-3.5 align-middle">
            ${
              tx
                ? `<button type="button" data-open-tx="${tx.id}" class="max-w-full truncate text-start text-xs text-cyan-200/85 transition hover:text-cyan-100 hover:underline">${escape(txLabel)}</button>`
                : `<span class="text-white/30">—</span>`
            }
          </td>
          <td class="max-w-[14rem] px-4 py-3.5 align-middle text-white/88">${escape(t.description)}</td>
          <td class="whitespace-nowrap px-4 py-3.5 align-middle font-mono text-sm text-violet-200/95">${formatCurrency(t.amount, cur)}</td>
          <td class="whitespace-nowrap px-4 py-3.5 align-middle text-white/48">${formatDate(t.expense_date)}</td>
          <td class="${staff ? "hidden px-4 py-3.5 align-middle font-mono text-[11px] text-white/38 lg:table-cell" : "hidden"}">${staff && t.user_id ? `${String(t.user_id).slice(0, 8)}…` : ""}</td>
          <td class="px-2 py-3 align-middle text-center">
            <div class="inline-flex items-center justify-center gap-1" role="group" aria-label="إجراءات">
              <button type="button" data-ex-edit="${txId}" class="${btnIconEdit} ${!txId ? "pointer-events-none opacity-35" : ""}" title="تعديل" aria-label="تعديل المصروف">${iconPencil}</button>
              <button type="button" data-ex-del="${t.id}" class="${btnIconDelete}" title="حذف" aria-label="حذف المصروف">${iconTrash}</button>
            </div>
          </td>
        </tr>
      `;
        })
        .join("");

      tbody.querySelectorAll("[data-open-tx]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-open-tx");
          if (id) api.navigate(`${TRANSACTION_DETAIL_PREFIX}${id}`);
        });
      });
    }

    mobileRows?.querySelectorAll("[data-open-tx]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-open-tx");
        if (id) api.navigate(`${TRANSACTION_DETAIL_PREFIX}${id}`);
      });
    });

    root.querySelectorAll("[data-ex-edit]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const tid = btn.getAttribute("data-ex-edit");
        if (tid) api.navigate(`${TRANSACTION_DETAIL_PREFIX}${tid}`);
      });
    });

    root.querySelectorAll("[data-ex-del]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-ex-del");
        if (!id) return;
        const ok = await confirmDialog({
          title: "حذف المصروف؟",
          message: "هل أنت متأكد من حذف هذا المصروف؟ لا يمكن التراجع.",
          confirmLabel: "حذف نهائياً",
          cancelLabel: "إلغاء",
          danger: true,
        });
        if (!ok) return;
        await api.onDelete(id);
      });
    });
  }

  function escape(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  const unsub = [
    api.subscribe("expenses", render),
    api.subscribe("transactions", render),
    api.subscribe("profile", render),
  ];
  render();

  return () => {
    ac.abort();
    unsub.forEach((u) => u());
    root.innerHTML = "";
  };
}
