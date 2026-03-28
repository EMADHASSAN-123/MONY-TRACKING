import { formatCurrency, formatDate } from "../utils/helpers.js";
import { TX_CATEGORIES, isStaffRole, TRANSACTION_DETAIL_PREFIX } from "../utils/constants.js";

function emojiFor(cat) {
  return TX_CATEGORIES.find((c) => c.id === cat)?.emoji ?? "✨";
}

/**
 * @param {HTMLElement} root
 * @param {{ getState: Function, subscribe: Function, onDelete: Function, navigate: Function }} api
 */
export function mountTransactionsList(root, api) {
  root.innerHTML = `
    <div class="space-y-6">
      <header class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs uppercase tracking-widest text-cyan-400/80">الحوالات</p>
          <h1 class="text-3xl font-bold text-white">⧉ آخر الحوالات</h1>
          <p class="mt-2 text-sm text-white/40">انقر على صف لعرض التفاصيل والمصروفات المرتبطة</p>
        </div>
        <p class="text-sm text-white/45" data-count></p>
      </header>
      <div class="md:hidden space-y-3" data-mobile-rows></div>
      <div class="hidden md:block overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
        <table class="min-w-full text-right text-sm">
          <thead class="border-b border-white/10 text-xs uppercase text-white/40">
            <tr>
              <th class="px-4 py-3">التصنيف</th>
              <th class="px-4 py-3">المرسل</th>
              <th class="px-4 py-3">المستفيد</th>
              <th class="px-4 py-3">المبلغ</th>
              <th class="px-4 py-3">التاريخ</th>
              <th class="hidden px-4 py-3" data-th-owner>المستخدم</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody data-rows></tbody>
        </table>
      </div>
    </div>
  `;

  const mobileRows = root.querySelector("[data-mobile-rows]");
  const tbody = root.querySelector("[data-rows]");
  const countEl = root.querySelector("[data-count]");

  const thOwner = root.querySelector("[data-th-owner]");

  const render = () => {
    const st = api.getState();
    const staff = isStaffRole(st.profile?.role);
    if (thOwner) {
      thOwner.classList.toggle("hidden", !staff);
      thOwner.classList.toggle("table-cell", staff);
    }
    const rows = st.transactions;
    countEl.textContent = `${rows.length} سجل — يتحدث مباشرة مع Realtime`;
    if (mobileRows) {
      mobileRows.innerHTML = rows
        .map((t) => {
          const cur = t.currency || "SAR";
          return `
            <div
              class="cursor-pointer rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-cyan-400/20 hover:bg-white/[0.04]"
              data-mobile-row="${t.id}"
              role="button"
              tabindex="0"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">${emojiFor(t.category)}</span>
                  <div class="text-sm font-semibold text-white/90 leading-snug">${escape(t.sender)} → ${escape(t.beneficiary)}</div>
                </div>
                <div class="text-left">
                  <div class="text-xs text-white/50">${formatDate(t.transaction_date)}</div>
                  <div class="mt-1 font-mono text-cyan-200">${formatCurrency(t.amount, cur)}</div>
                </div>
              </div>
              <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div class="text-[10px] text-white/35">${escape(t.category ?? "")}</div>
                <button type="button" data-del="${t.id}" class="rounded-lg px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10">
                  حذف
                </button>
              </div>
              <div class="mt-2 text-[10px] text-white/35 ${staff ? "" : "hidden"}" title="${escape(t.user_id ?? "")}">
                ${staff ? `المستخدم: ${shortId(t.user_id)}` : ""}
              </div>
            </div>
          `;
        })
        .join("");
    }

    if (tbody) {
      tbody.innerHTML = rows
        .map((t) => {
          const cur = t.currency || "SAR";
          return `
        <tr class="cursor-pointer border-b border-white/5 transition hover:bg-cyan-500/[0.08]" data-row="${t.id}" role="button" tabindex="0">
          <td class="px-4 py-3">${emojiFor(t.category)}</td>
          <td class="px-4 py-3 text-white/90">${escape(t.sender)}</td>
          <td class="px-4 py-3 text-white/90">${escape(t.beneficiary)}</td>
          <td class="px-4 py-3 font-mono text-cyan-200">${formatCurrency(t.amount, cur)}</td>
          <td class="px-4 py-3 text-white/50">${formatDate(t.transaction_date)}</td>
          <td class="px-4 py-3 font-mono text-[10px] text-white/35 ${staff ? "" : "hidden"}" title="${escape(t.user_id ?? "")}">${staff ? shortId(t.user_id) : ""}</td>
          <td class="px-4 py-3">
            <button type="button" data-del="${t.id}" class="rounded-lg px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10">حذف</button>
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
          if (e.target.closest("[data-del]")) return;
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

    // Delete handlers (for both mobile cards and desktop table)
    root.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-del");
        if (!id || !confirm("حذف هذه الحوالة؟")) return;
        await api.onDelete(id);
      });
    });

    // Mobile open handlers
    mobileRows?.querySelectorAll("[data-mobile-row]").forEach((card) => {
      const open = () => {
        const id = card.getAttribute("data-mobile-row");
        if (id) api.navigate(`${TRANSACTION_DETAIL_PREFIX}${id}`);
      };
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-del]")) return;
        open();
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });
  };

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
    unsub.forEach((u) => u());
    root.innerHTML = "";
  };
}
