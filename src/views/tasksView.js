import { ROUTES, isStaffRole } from "../utils/constants.js";

/** @type {Record<string, string>} */
const PRIORITY_AR = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "مرتفعة",
  urgent: "عاجلة",
};

/** @type {Record<string, string>} */
const STATUS_AR = {
  pending: "معلّقة",
  in_progress: "قيد التنفيذ",
  blocked: "متوقفة",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

/** @type {Record<string, string>} */
const EVENT_AR = {
  created: "إنشاء",
  updated: "تحديث",
  assigned: "تعيين",
  status_changed: "تغيير حالة",
  comment: "تعليق",
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {HTMLElement} root
 * @param {{
 *   initialTaskId: string | null,
 *   getState: Function,
 *   subscribe: Function,
 *   navigate: (path: string) => void,
 *   listUsers: () => Promise<Array<{ id: string, email?: string, full_name?: string, role?: string }>>,
 *   fetchTaskWithEvents: (id: string) => Promise<{ data: any, events: any[] }>,
 *   addTask: (row: any) => Promise<any>,
 *   patchTask: (id: string, patch: any) => Promise<any>,
 *   removeTask: (id: string) => Promise<any>,
 *   refreshTasks: () => Promise<void>,
 * }} api
 */
export function mountTasks(root, api) {
  /** @type {Array<{ id: string, email?: string, full_name?: string, role?: string }>} */
  let userDirectory = [];
  let filterStatus = "";
  let filterMine = false;

  root.innerHTML = `
    <div class="space-y-6">
      <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs uppercase tracking-widest text-cyan-400/80">تنظيم العمل</p>
          <h1 class="text-3xl font-bold text-white">✦ المهام</h1>
          <p class="mt-2 max-w-xl text-sm text-white/45">
           يمكنك انشاء مهام وتخصيصة الى احد المستخدمين ليقوم بتنفيذها وامكانية تتبع تنفيذ المعهمة مباشرة
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" data-action="refresh" class="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/85 hover:bg-white/5">
            تحديث القائمة
          </button>
          <button type="button" data-action="new-task" class="hidden rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-bold text-zinc-950 hover:bg-cyan-400">
            + مهمة جديدة
          </button>
        </div>
      </header>

      <div class="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <label class="flex items-center gap-2 text-sm text-white/70">
          <input type="checkbox" data-filter-mine class="rounded border-white/20" />
          <span>مهامي فقط (المكلف بها)</span>
        </label>
        <label class="text-sm text-white/60">
          الحالة
          <select data-filter-status class="mr-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/90">
            <option value="">الكل</option>
            <option value="pending">معلّقة</option>
            <option value="in_progress">قيد التنفيذ</option>
            <option value="blocked">متوقفة</option>
            <option value="completed">مكتملة</option>
            <option value="cancelled">ملغاة</option>
          </select>
        </label>
      </div>

      <div data-msg class="min-h-[1.25rem] text-sm"></div>

      <div data-list-wrap class="grid gap-4 lg:grid-cols-2 xl:grid-cols-3"></div>

      <div data-modal class="fixed inset-0 z-[300] hidden items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
        <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
          <div class="mb-4 flex items-center justify-between gap-3">
            <h2 class="text-lg font-bold text-white">مهمة جديدة</h2>
            <button type="button" data-close-modal class="text-white/50 hover:text-white">✕</button>
          </div>
          <form data-create-form class="space-y-4 text-sm">
            <label class="block">
              <span class="mb-1 block text-xs text-white/50">العنوان</span>
              <input name="title" required class="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs text-white/50">الوصف</span>
              <textarea name="description" rows="4" class="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2"></textarea>
            </label>
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="block">
                <span class="mb-1 block text-xs text-white/50">الأولوية</span>
                <select name="priority" class="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                  <option value="low">منخفضة</option>
                  <option value="medium" selected>متوسطة</option>
                  <option value="high">مرتفعة</option>
                  <option value="urgent">عاجلة</option>
                </select>
              </label>
              <label class="block">
                <span class="mb-1 block text-xs text-white/50">الحالة الأولية</span>
                <select name="status" class="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                  <option value="pending" selected>معلّقة</option>
                  <option value="in_progress">قيد التنفيذ</option>
                  <option value="blocked">متوقفة</option>
                </select>
              </label>
            </div>
            <label class="block">
              <span class="mb-1 block text-xs text-white/50">تعيين إلى</span>
              <select name="assigned_to" required class="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2"></select>
            </label>
            <label class="block">
              <span class="mb-1 block text-xs text-white/50">الموعد النهائي (اختياري)</span>
              <input name="due_at" type="datetime-local" class="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2" />
            </label>
            <button type="submit" class="w-full rounded-xl bg-cyan-500 py-3 text-sm font-bold text-zinc-950 hover:bg-cyan-400">إنشاء</button>
          </form>
        </div>
      </div>

      <div data-detail class="hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6"></div>
    </div>
  `;

  const msg = root.querySelector("[data-msg]");
  const listWrap = root.querySelector("[data-list-wrap]");
  const detailEl = root.querySelector("[data-detail]");
  const modal = root.querySelector("[data-modal]");
  const btnNew = root.querySelector("[data-action='new-task']");
  const btnRefresh = root.querySelector("[data-action='refresh']");
  const filterMineEl = root.querySelector("[data-filter-mine]");
  const filterStatusEl = root.querySelector("[data-filter-status]");
  const createForm = root.querySelector("[data-create-form]");

  function showMsg(text, kind = "ok") {
    if (!msg) return;
    msg.textContent = text;
    msg.className = `min-h-[1.25rem] text-sm ${kind === "ok" ? "text-emerald-300" : "text-rose-300"}`;
  }

  function userLabel(id) {
    const u = userDirectory.find((x) => x.id === id);
    if (!u) return id.slice(0, 8) + "…";
    const name = (u.full_name || "").trim();
    const em = (u.email || "").trim();
    return name || em || id.slice(0, 8) + "…";
  }

  function visibleTasks() {
    const st = api.getState();
    const uid = st.sessionUser?.id;
    let rows = [...(st.tasks || [])];
    if (filterMine && uid) {
      rows = rows.filter((t) => t.assigned_to === uid);
    }
    if (filterStatus) {
      rows = rows.filter((t) => t.status === filterStatus);
    }
    return rows;
  }

  function renderList() {
    if (!listWrap) return;
    const rows = visibleTasks();
    const st = api.getState();
    const uid = st.sessionUser?.id;
    if (!rows.length) {
      listWrap.innerHTML = `<p class="text-sm text-white/40 lg:col-span-full">لا توجد مهام مطابقة.</p>`;
      return;
    }
    listWrap.innerHTML = rows
      .map((t) => {
        const mine = uid && t.assigned_to === uid;
        return `
        <button type="button" data-open-task="${t.id}" class="rounded-2xl border border-white/10 bg-black/20 p-4 text-right transition hover:border-cyan-400/30 hover:bg-white/[0.03]">
          <div class="flex items-start justify-between gap-2">
            <span class="text-lg font-bold text-white/90">${escapeHtml(t.title)}</span>
            ${mine ? `<span class="shrink-0 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] text-cyan-200">لـ</span>` : ""}
          </div>
          <p class="mt-2 line-clamp-2 text-xs text-white/45">${escapeHtml(t.description || "")}</p>
          <div class="mt-3 flex flex-wrap gap-2 text-[11px] text-white/55">
            <span class="rounded-lg bg-white/5 px-2 py-1">${STATUS_AR[t.status] ?? t.status}</span>
            <span class="rounded-lg bg-white/5 px-2 py-1">${PRIORITY_AR[t.priority] ?? t.priority}</span>
            <span class="rounded-lg bg-white/5 px-2 py-1">إلى: ${escapeHtml(userLabel(t.assigned_to))}</span>
          </div>
        </button>
      `;
      })
      .join("");

    listWrap.querySelectorAll("[data-open-task]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-open-task");
        if (id) api.navigate(`${ROUTES.TASKS}/${id}`);
      });
    });
  }

  function renderDetail(task, events) {
    if (!detailEl) return;
    const st = api.getState();
    const staff = isStaffRole(st.profile?.role);
    const uid = st.sessionUser?.id;
    const assignee = uid && task.assigned_to === uid;

    detailEl.classList.remove("hidden");
    detailEl.innerHTML = `
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button type="button" data-back class="text-sm text-cyan-300 hover:underline">← العودة للقائمة</button>
        ${
          staff
            ? `<button type="button" data-delete-task class="text-sm text-rose-300 hover:underline">حذف المهمة</button>`
            : ""
        }
      </div>
      <h2 class="text-2xl font-bold text-white">${escapeHtml(task.title)}</h2>
      <form data-edit-task class="mt-6 space-y-4 text-sm">
        <input type="hidden" name="id" value="${escapeHtml(task.id)}" />
        <label class="block ${staff ? "" : "hidden"}">
          <span class="mb-1 block text-xs text-white/50">العنوان</span>
          <input name="title" value="${escapeHtml(task.title)}" class="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs text-white/50">الوصف</span>
          <textarea name="description" rows="5" class="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2">${escapeHtml(
            task.description || "",
          )}</textarea>
        </label>
        <div class="grid gap-3 md:grid-cols-2 ${staff ? "" : "hidden"}">
          <label class="block">
            <span class="mb-1 block text-xs text-white/50">الأولوية</span>
            <select name="priority" class="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2">
              ${["low", "medium", "high", "urgent"]
                .map(
                  (p) =>
                    `<option value="${p}" ${p === task.priority ? "selected" : ""}>${PRIORITY_AR[p]}</option>`,
                )
                .join("")}
            </select>
          </label>
          <label class="block">
            <span class="mb-1 block text-xs text-white/50">الحالة</span>
            <select name="status" class="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2">
              ${["pending", "in_progress", "blocked", "completed", "cancelled"]
                .map(
                  (s) =>
                    `<option value="${s}" ${s === task.status ? "selected" : ""}>${STATUS_AR[s]}</option>`,
                )
                .join("")}
            </select>
          </label>
        </div>
        <div class="${!staff && assignee ? "" : "hidden"}">
          <label class="block">
            <span class="mb-1 block text-xs text-white/50">تحديث الحالة</span>
            <select name="status_assignee" class="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2">
              ${["pending", "in_progress", "blocked", "completed", "cancelled"]
                .map(
                  (s) =>
                    `<option value="${s}" ${s === task.status ? "selected" : ""}>${STATUS_AR[s]}</option>`,
                )
                .join("")}
            </select>
          </label>
        </div>
        <label class="block ${staff ? "" : "hidden"}">
          <span class="mb-1 block text-xs text-white/50">تعيين إلى</span>
          <select name="assigned_to" class="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2"></select>
        </label>
        <label class="block ${staff ? "" : "hidden"}">
          <span class="mb-1 block text-xs text-white/50">الموعد النهائي</span>
          <input name="due_at" type="datetime-local" class="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2" value="${task.due_at ? task.due_at.slice(0, 16) : ""}" />
        </label>
        <button type="submit" class="rounded-xl bg-cyan-500 px-6 py-2.5 text-sm font-bold text-zinc-950 hover:bg-cyan-400">
          حفظ التعديلات
        </button>
      </form>

      <div class="mt-10 border-t border-white/10 pt-6">
        <h3 class="text-sm font-bold text-white/80">سجل التتبع</h3>
        <ul class="mt-4 space-y-3 text-sm text-white/70">
          ${(events || [])
            .map((ev) => {
              const label = EVENT_AR[ev.event_type] ?? ev.event_type;
              const when = ev.created_at ? new Date(ev.created_at).toLocaleString("ar-SA") : "";
              return `
                <li class="rounded-xl border border-white/5 bg-black/20 px-4 py-3">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="font-semibold text-cyan-200/90">${escapeHtml(label)}</span>
                    <span class="text-[11px] text-white/35">${escapeHtml(when)}</span>
                  </div>
                  <p class="mt-1 text-xs text-white/45">بواسطة: ${escapeHtml(userLabel(ev.actor_id))}</p>
                </li>
              `;
            })
            .join("")}
        </ul>
      </div>
    `;

    detailEl.querySelector("[data-back]")?.addEventListener("click", () => {
      api.navigate(ROUTES.TASKS);
    });

    detailEl.querySelector("[data-delete-task]")?.addEventListener("click", async () => {
      if (!confirm("حذف المهمة نهائيًا؟")) return;
      showMsg("");
      try {
        await api.removeTask(task.id);
        showMsg("تم الحذف.");
        api.navigate(ROUTES.TASKS);
        renderList();
        detailEl.classList.add("hidden");
        detailEl.innerHTML = "";
      } catch (e) {
        showMsg(e instanceof Error ? e.message : "فشل الحذف", "err");
      }
    });

    const assignSelect = detailEl.querySelector("select[name='assigned_to']");
    if (assignSelect) {
      assignSelect.innerHTML = userDirectory
        .map(
          (u) =>
            `<option value="${escapeHtml(u.id)}" ${u.id === task.assigned_to ? "selected" : ""}>${escapeHtml(
              (u.full_name || u.email || u.id).slice(0, 48),
            )}</option>`,
        )
        .join("");
    }

    detailEl.querySelector("[data-edit-task]")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = /** @type {HTMLFormElement} */ (e.target);
      const fd = new FormData(f);
      showMsg("");
      try {
        if (staff) {
          const due = fd.get("due_at");
          await api.patchTask(task.id, {
            title: String(fd.get("title") || ""),
            description: String(fd.get("description") || ""),
            priority: String(fd.get("priority") || "medium"),
            status: String(fd.get("status") || ""),
            assigned_to: String(fd.get("assigned_to") || ""),
            due_at: due ? new Date(String(due)).toISOString() : null,
          });
        } else if (assignee) {
          await api.patchTask(task.id, {
            description: String(fd.get("description") || ""),
            status: String(fd.get("status_assignee") || ""),
          });
        }
        showMsg("تم حفظ التعديلات.");
        const fresh = await api.fetchTaskWithEvents(task.id);
        renderDetail(fresh.data, fresh.events);
        renderList();
      } catch (err) {
        showMsg(err instanceof Error ? err.message : "فشل الحفظ", "err");
      }
    });
  }

  async function openDetail(taskId) {
    showMsg("");
    try {
      const { data, events } = await api.fetchTaskWithEvents(taskId);
      renderDetail(data, events);
      listWrap?.classList.add("hidden");
    } catch (e) {
      showMsg(e instanceof Error ? e.message : "فشل التحميل", "err");
    }
  }

  function closeDetailIfList() {
    detailEl?.classList.add("hidden");
    if (detailEl) detailEl.innerHTML = "";
    listWrap?.classList.remove("hidden");
  }

  function applyStaffUi() {
    const st = api.getState();
    const staff = isStaffRole(st.profile?.role);
    if (btnNew) btnNew.classList.toggle("hidden", !staff);
  }

  async function hydrateUsers() {
    try {
      userDirectory = await api.listUsers();
      const sel = createForm?.querySelector("select[name='assigned_to']");
      if (sel) {
        sel.innerHTML = userDirectory
          .map(
            (u) =>
              `<option value="${escapeHtml(u.id)}">${escapeHtml((u.full_name || u.email || u.id).slice(0, 48))}</option>`,
          )
          .join("");
      }
    } catch {
      userDirectory = [];
    }
  }

  function onState() {
    applyStaffUi();
    renderList();
  }

  const unsub = api.subscribe("tasks", onState);
  const unsubProfile = api.subscribe("profile", onState);
  const unsubAuth = api.subscribe("auth", () => {
    hydrateUsers().finally(() => {
      onState();
      applyStaffUi();
    });
  });

  filterMineEl?.addEventListener("change", () => {
    filterMine = !!filterMineEl.checked;
    renderList();
  });
  filterStatusEl?.addEventListener("change", () => {
    filterStatus = String(filterStatusEl.value || "");
    renderList();
  });

  btnRefresh?.addEventListener("click", async () => {
    showMsg("");
    try {
      await api.refreshTasks();
      showMsg("تم التحديث.");
    } catch (e) {
      showMsg(e instanceof Error ? e.message : "فشل", "err");
    }
  });

  btnNew?.addEventListener("click", () => {
    modal?.classList.remove("hidden");
    modal?.classList.add("flex");
  });
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    }
  });
  root.querySelector("[data-close-modal]")?.addEventListener("click", () => {
    modal?.classList.add("hidden");
    modal?.classList.remove("flex");
  });

  createForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(/** @type {HTMLFormElement} */ (e.target));
    const due = fd.get("due_at");
    showMsg("");
    try {
      await api.addTask({
        title: String(fd.get("title") || ""),
        description: String(fd.get("description") || ""),
        priority: String(fd.get("priority") || "medium"),
        status: String(fd.get("status") || "pending"),
        assigned_to: String(fd.get("assigned_to") || ""),
        due_at: due ? new Date(String(due)).toISOString() : null,
      });
      modal?.classList.add("hidden");
      modal?.classList.remove("flex");
      showMsg("تم إنشاء المهمة.");
      renderList();
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "فشل الإنشاء", "err");
    }
  });

  hydrateUsers().finally(() => {
    applyStaffUi();
    onState();
    if (api.initialTaskId) {
      openDetail(api.initialTaskId);
    } else {
      closeDetailIfList();
    }
  });

  return () => {
    unsub?.();
    unsubProfile?.();
    unsubAuth?.();
  };
}
