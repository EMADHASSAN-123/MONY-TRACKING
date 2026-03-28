import { isAdminRole } from "../utils/constants.js";

/**
 * @param {HTMLElement} root
 * @param {{ getState: Function, subscribe: Function, listUsers: () => Promise<any[]>, createUser: Function, updateRole: Function }} api
 */
export function mountAdminUsers(root, api) {
  root.innerHTML = `
    <div class="space-y-8">
      <header>
        <p class="text-xs uppercase tracking-widest text-amber-400/80">إدارة</p>
        <h1 class="text-3xl font-bold text-white">⛭ المستخدمون والأدوار</h1>
        <p class="mt-2 text-sm text-white/45">المدير والمسؤول يريان القائمة؛ إضافة مستخدم وتعديل الأدوار للمسؤول فقط (يتطلب Edge Function: admin-users)</p>
      </header>
      <div data-admin-form class="hidden rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6"></div>
      <div data-admin-cards class="md:hidden space-y-3"></div>
      <div class="hidden md:block overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
        <table class="min-w-full text-right text-sm">
          <thead class="border-b border-white/10 text-xs uppercase text-white/40">
            <tr>
              <th class="px-4 py-3">البريد</th>
              <th class="px-4 py-3">الاسم</th>
              <th class="px-4 py-3">الدور</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody data-rows></tbody>
        </table>
      </div>
      <p data-msg class="min-h-[1.25rem] text-sm"></p>
    </div>
  `;

  const tbody = root.querySelector("[data-rows]");
  const cards = root.querySelector("[data-admin-cards]");
  const formWrap = root.querySelector("[data-admin-form]");
  const msg = root.querySelector("[data-msg]");

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  async function refreshTable() {
    msg.textContent = "";
    msg.className = "min-h-[1.25rem] text-sm";
    try {
      const rows = await api.listUsers();
      const st = api.getState();
      tbody.innerHTML = rows
        .map((u) => {
          const canPatch =
            isAdminRole(st.profile?.role) && u.id !== st.sessionUser?.id;
          return `
        <tr class="border-b border-white/5" data-uid="${u.id}">
          <td class="px-4 py-3 text-white/85">${escapeHtml(u.email || "—")}</td>
          <td class="px-4 py-3 text-white/60">${escapeHtml(u.full_name || "")}</td>
          <td class="px-4 py-3">
            ${
              canPatch
                ? `<select data-role-select class="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs">
                ${["user", "manager", "admin"]
                  .map(
                    (r) =>
                      `<option value="${r}" ${r === u.role ? "selected" : ""}>${r}</option>`,
                  )
                  .join("")}
              </select>`
                : `<span class="text-white/70">${escapeHtml(u.role)}</span>`
            }
          </td>
          <td class="px-4 py-3">
            ${
              canPatch
                ? `<button type="button" data-save-role class="text-xs text-cyan-300 hover:underline">حفظ الدور</button>`
                : ""
            }
          </td>
        </tr>
      `;
        })
        .join("");

      if (cards) {
        cards.innerHTML = rows
          .map((u) => {
            const canPatch =
              isAdminRole(st.profile?.role) && u.id !== st.sessionUser?.id;
            return `
              <div class="rounded-2xl border border-white/10 bg-white/[0.02] p-4" data-uid="${u.id}">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="text-[10px] text-white/35">البريد</div>
                    <div class="mt-1 truncate text-sm font-semibold text-white/85">${escapeHtml(u.email || "—")}</div>
                    <div class="mt-2 text-[10px] text-white/35">الاسم</div>
                    <div class="mt-1 truncate text-sm text-white/60">${escapeHtml(u.full_name || "")}</div>
                  </div>
                  <div class="text-right">
                    <div class="text-[10px] text-white/35">الدور</div>
                    <div class="mt-1">
                      ${
                        canPatch
                          ? `<select data-role-select class="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs">
                              ${["user", "manager", "admin"]
                                .map(
                                  (r) =>
                                    `<option value="${r}" ${r === u.role ? "selected" : ""}>${r}</option>`,
                                )
                                .join("")}
                            </select>`
                          : `<span class="text-sm text-white/70">${escapeHtml(u.role)}</span>`
                      }
                    </div>
                    <div class="mt-2">
                      ${
                        canPatch
                          ? `<button type="button" data-save-role class="text-xs text-cyan-300 hover:underline">حفظ الدور</button>`
                          : ""
                      }
                    </div>
                  </div>
                </div>
              </div>
            `;
          })
          .join("");
      }

      root.querySelectorAll("[data-save-role]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const wrap = btn.closest("[data-uid]");
          const uid = wrap?.getAttribute("data-uid");
          const sel = wrap?.querySelector("[data-role-select]");
          const role = sel?.value;
          if (!uid || !role) return;
          msg.textContent = "";
          try {
            await api.updateRole(uid, role);
            msg.textContent = "تم تحديث الدور.";
            msg.className = "min-h-[1.25rem] text-sm text-emerald-300";
            await refreshTable();
          } catch (err) {
            msg.textContent = err instanceof Error ? err.message : "فشل";
            msg.className = "min-h-[1.25rem] text-sm text-rose-300";
          }
        });
      });
    } catch (err) {
      msg.textContent = err instanceof Error ? err.message : "فشل التحميل";
      msg.className = "min-h-[1.25rem] text-sm text-rose-300";
    }
  }

  function renderForm() {
    const st = api.getState();
    if (!isAdminRole(st.profile?.role)) {
      formWrap.classList.add("hidden");
      formWrap.innerHTML = "";
      return;
    }
    formWrap.classList.remove("hidden");
    formWrap.innerHTML = `
      <h2 class="mb-4 text-sm font-bold text-amber-200/90">إضافة مستخدم (مسؤول)</h2>
      <form id="admin-new-user" class="grid gap-3 sm:grid-cols-2">
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-xs text-white/50">البريد</span>
          <input name="email" type="email" required class="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs text-white/50">كلمة المرور</span>
          <input name="password" type="password" required minlength="6" class="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs text-white/50">الدور</span>
          <select name="role" class="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm">
            <option value="user">مستخدم</option>
            <option value="manager">مدير</option>
            <option value="admin">مسؤول</option>
          </select>
        </label>
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-xs text-white/50">الاسم (اختياري)</span>
          <input name="full_name" type="text" class="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm" />
        </label>
        <button type="submit" class="sm:col-span-2 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-400">إنشاء الحساب</button>
      </form>
    `;
    root.querySelector("#admin-new-user")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = /** @type {HTMLFormElement} */ (e.target);
      msg.textContent = "";
      const fd = new FormData(f);
      try {
        await api.createUser({
          email: String(fd.get("email") || ""),
          password: String(fd.get("password") || ""),
          role: String(fd.get("role") || "user"),
          full_name: String(fd.get("full_name") || ""),
        });
        f.reset();
        msg.textContent = "تم إنشاء المستخدم.";
        msg.className = "min-h-[1.25rem] text-sm text-emerald-300";
        await refreshTable();
      } catch (err) {
        msg.textContent = err instanceof Error ? err.message : "فشل";
        msg.className = "min-h-[1.25rem] text-sm text-rose-300";
      }
    });
  }

  const unsub = api.subscribe("profile", () => {
    renderForm();
  });

  renderForm();
  refreshTable();

  return () => {
    unsub();
    root.innerHTML = "";
  };
}
