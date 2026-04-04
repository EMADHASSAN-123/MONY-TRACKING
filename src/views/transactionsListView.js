import { formatCurrency, formatDate } from "../utils/helpers.js";
import {
  TX_CATEGORIES,
  isStaffRole,
  TRANSACTION_DETAIL_PREFIX,
  LIST_VIEW_PAGE_STEP,
} from "../utils/constants.js";
import { iconPencil, iconTrash, btnIconEdit, btnIconDelete } from "../components/icons.js";
import { confirmDialog } from "../components/confirmDialog.js";

function emojiFor(cat) {
  return TX_CATEGORIES.find((c) => c.id === cat)?.emoji ?? "✨";
}

const tableWrap =
  "overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.025] shadow-sm ring-1 ring-white/[0.04]";
const theadRow =
  "border-b border-white/[0.08] bg-white/[0.04] text-[11px] font-semibold uppercase tracking-wider text-white/45";
const tbodyTr =
  "group border-b border-white/[0.06] transition-colors hover:bg-cyan-500/[0.06] last:border-0";

/**
 * @param {HTMLElement} root
 * @param {{ getState: Function, subscribe: Function, onDelete: Function, navigate: Function }} api
 */
export function mountTransactionsList(root, api) {
  root.innerHTML = `
    <div class="space-y-5 sm:space-y-6">
      <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div class="space-y-1">
          <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400/70">الحوالات</p>
          <h1 class="text-2xl font-bold text-white sm:text-3xl">⧉ الحوالات</h1>
          <p class="max-w-xl text-sm text-white/45">اضغط الصف للتفاصيل — أيقونة القلم تفتح التعديل من صفحة الحوالة</p>
        </div>
        <p class="shrink-0 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/50" data-count></p>
      </header>
      <div class="space-y-3 md:hidden" data-mobile-rows></div>
      <div class="hidden md:block ${tableWrap}">
        <table class="min-w-full text-right text-sm">
          <thead class="${theadRow}">
            <tr>
              <th class="px-4 py-3.5 font-medium">التصنيف</th>
              <th class="px-4 py-3.5 font-medium">المرسل</th>
              <th class="px-4 py-3.5 font-medium">المستفيد</th>
              <th class="px-4 py-3.5 font-medium">المبلغ</th>
              <th class="px-4 py-3.5 font-medium">التاريخ</th>
              <th class="hidden px-4 py-3.5 font-medium lg:table-cell" data-th-owner>المستخدم</th>
              <th class="w-[1%] whitespace-nowrap px-3 py-3.5 text-center font-medium text-white/40">إجراءات</th>
            </tr>
          </thead>
          <tbody data-rows></tbody>
        </table>
      </div>
      <div class="hidden justify-center pt-1" data-more-wrap>
        <button type="button" data-tx-load-more class="rounded-xl border border-white/12 bg-white/[0.05] px-5 py-2.5 text-sm text-white/80 transition hover:border-white/18 hover:bg-white/[0.09]">
          عرض المزيد
        </button>
      </div>
    </div>
  `;

  const mobileRows = root.querySelector("[data-mobile-rows]");
  const tbody = root.querySelector("[data-rows]");
  const countEl = root.querySelector("[data-count]");
  const thOwner = root.querySelector("[data-th-owner]");
  const moreWrap = root.querySelector("[data-more-wrap]");
  let visibleCount = LIST_VIEW_PAGE_STEP;

  const ac = new AbortController();
  root.addEventListener(
    "click",
    (e) => {
      const t = e.target.closest("[data-tx-load-more]");
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
    const all = st.transactions;
    const rows = all.slice(0, visibleCount);
    const rest = all.length - rows.length;
    countEl.textContent =
      all.length <= visibleCount
        ? `${all.length} حوالة`
        : `${rows.length} من ${all.length}`;
    if (moreWrap) {
      const showMore = rest > 0;
      moreWrap.classList.toggle("hidden", !showMore);
      moreWrap.classList.toggle("flex", showMore);
      const btn = moreWrap.querySelector("[data-tx-load-more]");
      if (btn) btn.textContent = `عرض المزيد (${Math.min(LIST_VIEW_PAGE_STEP, rest)} · ${rest} متبقي)`;
    }

    if (mobileRows) {
      mobileRows.innerHTML = rows
        .map((t) => {
          const cur = t.currency || "SAR";
          return `
            <article
              class="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 shadow-sm ring-1 ring-white/[0.04] transition hover:border-cyan-400/20"
              data-mobile-row="${t.id}"
              role="button"
              tabindex="0"
              aria-label="فتح تفاصيل الحوالة"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex min-w-0 flex-1 items-center gap-2.5">
                  <span class="text-xl leading-none">${emojiFor(t.category)}</span>
                  <div class="min-w-0 text-sm font-semibold leading-snug text-white/90">${escape(t.sender)} → ${escape(t.beneficiary)}</div>
                </div>
                <div class="shrink-0 text-left">
                  <div class="text-[11px] text-white/45">${formatDate(t.transaction_date)}</div>
                  <div class="mt-1 font-mono text-sm text-cyan-200/95">${formatCurrency(t.amount, cur)}</div>
                </div>
              </div>
              <div class="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                <span class="text-[11px] text-white/35">${escape(t.category ?? "")}</span>
                <div class="flex items-center gap-1" role="group" aria-label="إجراءات">
                  <button type="button" data-tx-edit="${t.id}" class="${btnIconEdit}" title="تعديل الحوالة" aria-label="تعديل الحوالة">${iconPencil}</button>
                  <button type="button" data-tx-del="${t.id}" class="${btnIconDelete}" title="حذف الحوالة" aria-label="حذف الحوالة">${iconTrash}</button>
                </div>
              </div>
              <div class="mt-2 text-[10px] text-white/30 ${staff ? "" : "hidden"}">${staff ? `مستخدم: ${shortId(t.user_id)}` : ""}</div>
            </article>
          `;
        })
        .join("");
    }

    if (tbody) {
      tbody.innerHTML = rows
        .map((t) => {
          const cur = t.currency || "SAR";
          return `
        <tr class="cursor-pointer ${tbodyTr}" data-row="${t.id}" role="button" tabindex="0" aria-label="فتح تفاصيل الحوالة">
          <td class="px-4 py-3.5 align-middle text-base">${emojiFor(t.category)}</td>
          <td class="px-4 py-3.5 align-middle text-white/88">${escape(t.sender)}</td>
          <td class="px-4 py-3.5 align-middle text-white/88">${escape(t.beneficiary)}</td>
          <td class="px-4 py-3.5 align-middle font-mono text-sm text-cyan-200/95">${formatCurrency(t.amount, cur)}</td>
          <td class="px-4 py-3.5 align-middle text-white/48">${formatDate(t.transaction_date)}</td>
          <td class="${staff ? "hidden px-4 py-3.5 align-middle font-mono text-[11px] text-white/38 lg:table-cell" : "hidden"}" title="${escape(t.user_id ?? "")}">${staff ? shortId(t.user_id) : ""}</td>
          <td class="px-2 py-3 align-middle text-center" data-stop-nav>
            <div class="inline-flex items-center justify-center gap-1 opacity-90 transition group-hover:opacity-100" role="group" aria-label="إجراءات">
              <button type="button" data-tx-edit="${t.id}" class="${btnIconEdit}" title="تعديل" aria-label="تعديل الحوالة">${iconPencil}</button>
              <button type="button" data-tx-del="${t.id}" class="${btnIconDelete}" title="حذف" aria-label="حذف الحوالة">${iconTrash}</button>
            </div>
          </td>
        </tr>
      `;
        })
        .join("");

      tbody.querySelectorAll("[data-row]").forEach((tr) => {
        const open = () => {
          const id = tr.getAttribute("data-row");
          if (id) api.navigate(`${TRANSACTION_DETAIL_PREFIX}${id}`);
        };
        tr.addEventListener("click", (e) => {
          if (e.target.closest("[data-stop-nav]") || e.target.closest("[data-tx-del]") || e.target.closest("[data-tx-edit]")) return;
          open();
        });
        tr.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        });
      });
    }

    root.querySelectorAll("[data-tx-edit]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-tx-edit");
        if (id) api.navigate(`${TRANSACTION_DETAIL_PREFIX}${id}`);
      });
    });

    root.querySelectorAll("[data-tx-del]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-tx-del");
        if (!id) return;
        const ok = await confirmDialog({
          title: "حذف الحوالة؟",
          message: "سيتم حذف الحوالة وجميع المصروفات المرتبطة بها. لا يمكن التراجع عن هذا الإجراء.",
          confirmLabel: "حذف نهائياً",
          cancelLabel: "إلغاء",
          danger: true,
        });
        if (!ok) return;
        await api.onDelete(id);
      });
    });

    mobileRows?.querySelectorAll("[data-mobile-row]").forEach((card) => {
      const open = () => {
        const id = card.getAttribute("data-mobile-row");
        if (id) api.navigate(`${TRANSACTION_DETAIL_PREFIX}${id}`);
      };
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-tx-del]") || e.target.closest("[data-tx-edit]")) return;
        open();
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (e.target.closest("[data-tx-del]") || e.target.closest("[data-tx-edit]")) return;
          open();
        }
      });
    });
  }

  function escape(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function shortId(id) {
    if (!id) return "—";
    return `${String(id).slice(0, 8)}…`;
  }

  const unsub = [api.subscribe("transactions", render), api.subscribe("profile", render)];
  render();

  return () => {
    ac.abort();
    unsub.forEach((u) => u());
    root.innerHTML = "";
  };
}
