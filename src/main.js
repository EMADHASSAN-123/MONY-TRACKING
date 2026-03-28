import { startRouter, navigate, getRoute, getHashSearchParams } from "./router.js";
import {
  ROUTES,
  ROUTE_LABELS,
  isStaffRole,
  matchTransactionDetailPath,
  matchTaskDetailPath,
  isUuid,
} from "./utils/constants.js";
import * as state from "./state.js";
import * as dashboardPage from "./pages/dashboardPage.js";
import * as addTransactionPage from "./pages/addTransactionPage.js";
import * as addExpensePage from "./pages/addExpensePage.js";
import * as transactionsListPage from "./pages/transactionsListPage.js";
import * as expensesListPage from "./pages/expensesListPage.js";
import * as reportsPage from "./pages/reportsPage.js";
import * as adminUsersPage from "./pages/adminUsersPage.js";
import * as transactionDetailPage from "./pages/transactionDetailPage.js";
import * as tasksPage from "./pages/tasksPage.js";

/** @type {Record<string, { mount: (el: HTMLElement) => () => void }>} */
const routes = {
  [ROUTES.DASHBOARD]: dashboardPage,
  [ROUTES.ADD_TRANSACTION]: addTransactionPage,
  [ROUTES.ADD_EXPENSE]: addExpensePage,
  [ROUTES.TRANSACTIONS]: transactionsListPage,
  [ROUTES.EXPENSES]: expensesListPage,
  [ROUTES.REPORTS]: reportsPage,
  [ROUTES.TASKS]: tasksPage,
  [ROUTES.ADMIN_USERS]: adminUsersPage,
};

let unmountOutlet = () => {};

const THEME_KEY = "mony-theme";
const CUSTOM_THEME_KEY = "mony-theme-custom";

function getPreferredTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  // fallback to system preference
  const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
  return mql?.matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.body.classList.toggle("theme-light", theme === "light");
  localStorage.setItem(THEME_KEY, theme);

  const btn = document.getElementById("btn-theme-toggle");
  if (btn) btn.textContent = theme === "light" ? "☀" : "☾";
}

/** @returns {{ cyan?: string, violet?: string, emerald?: string, rose?: string }|null} */
function loadCustomTheme() {
  try {
    const raw = localStorage.getItem(CUSTOM_THEME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

/** @param {{ cyan?: string, violet?: string, emerald?: string, rose?: string }|null} custom */
function applyCustomTheme(custom) {
  const root = document.documentElement;
  const map = custom || {};
  const entries = [
    ["--mony-cyan-rgb", map.cyan],
    ["--mony-violet-rgb", map.violet],
    ["--mony-emerald-rgb", map.emerald],
    ["--mony-rose-rgb", map.rose],
  ];
  for (const [k, v] of entries) {
    if (v && typeof v === "string") {
      root.style.setProperty(k, v);
    } else {
      root.style.removeProperty(k);
    }
  }
}

/** @param {string} hex like #22d3ee */
function hexToRgbTuple(hex) {
  const h = hex.trim().replace("#", "");
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return [r, g, b];
}

/** @param {string} css like "34, 211, 238" */
function rgbTupleToHex(css) {
  if (!css) return "#ffffff";
  const parts = css.split(",").map((x) => parseInt(x.trim(), 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return "#ffffff";
  const [r, g, b] = parts;
  const toHex = (n) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function navItemsHTML() {
  const staff = isStaffRole(state.getState().profile?.role);
  return Object.entries(ROUTE_LABELS)
    .filter(
      ([path]) =>
        (path !== ROUTES.ADMIN_USERS || staff) &&
        path !== ROUTES.ADD_EXPENSE,
    )
    .map(
      ([path, meta]) => `
      <a href="#${path}" data-nav="${path}" class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/5 hover:text-white">
        <span class="text-lg">${meta.icon}</span>
        <span>${meta.title}</span>
      </a>
    `,
    )
    .join("");
}

function renderNav() {
  const nav = document.getElementById("main-nav");
  if (nav) nav.innerHTML = navItemsHTML();
}

function updateNavActive(path) {
  const taskDetailId = matchTaskDetailPath(path);
  const txDetailId = matchTransactionDetailPath(path);
  const navPath = taskDetailId ? ROUTES.TASKS : txDetailId ? ROUTES.TRANSACTIONS : path;
  document.querySelectorAll("[data-nav]").forEach((a) => {
    const p = a.getAttribute("data-nav");
    const on = p === navPath;
    a.classList.toggle("bg-cyan-500/10", on);
    a.classList.toggle("text-cyan-100", on);
    a.classList.toggle("ring-1", on);
    a.classList.toggle("ring-cyan-400/20", on);
  });
  const title = taskDetailId
    ? "تفاصيل مهمة"
    : txDetailId
      ? "تفاصيل حوالة"
      : (ROUTE_LABELS[path]?.title ?? path);
  const el = document.getElementById("route-title");
  if (el) el.textContent = title;
}

function mountRoute(path) {
  const outlet = document.getElementById("app-outlet");
  if (!outlet) return;
  unmountOutlet();

  const taskDetailId = matchTaskDetailPath(path);
  if (taskDetailId) {
    unmountOutlet = tasksPage.mount(outlet, taskDetailId) || (() => {});
    updateNavActive(path);
    return;
  }

  const detailId = matchTransactionDetailPath(path);
  if (detailId) {
    unmountOutlet = transactionDetailPage.mount(outlet, detailId) || (() => {});
    updateNavActive(path);
    return;
  }

  const mod = routes[path];
  if (!mod) {
    navigate(ROUTES.DASHBOARD);
    return;
  }
  unmountOutlet = mod.mount(outlet) || (() => {});
  updateNavActive(path);
}

function showApp(user) {
  const gate = document.getElementById("auth-gate");
  const shell = document.getElementById("app-shell");
  if (user) {
    gate?.classList.add("hidden");
    shell?.classList.remove("hidden");
    shell?.classList.add("flex");
  } else {
    gate?.classList.remove("hidden");
    shell?.classList.add("hidden");
    shell?.classList.remove("flex");
    unmountOutlet();
    unmountOutlet = () => {};
  }
}

/** Command palette */
function paletteCommands() {
  const staff = isStaffRole(state.getState().profile?.role);
  return Object.entries(ROUTE_LABELS)
    .filter(([path]) => path !== ROUTES.ADMIN_USERS || staff)
    .map(([path, meta]) => {
      const toPath = path === ROUTES.ADD_EXPENSE ? ROUTES.TRANSACTIONS : path;
      const label =
        path === ROUTES.ADD_EXPENSE
          ? `💸 إضافة مصروف (من الحوالات)`
          : `${meta.icon} ${meta.title}`;
      return {
        path: toPath,
        label,
        keywords: `${meta.titleEn} ${path}`,
      };
    });
}

function setupCommandPalette() {
  const root = document.querySelector("[data-command-palette]");
  const input = root?.querySelector("[data-palette-input]");
  const list = root?.querySelector("[data-palette-list]");
  if (!root || !input || !list) return;

  const open = () => {
    root.classList.add("open");
    input.value = "";
    renderList("");
    input.focus();
  };
  const close = () => root.classList.remove("open");

  function renderList(filter) {
    const q = filter.trim().toLowerCase();
    const cmds = paletteCommands().filter(
      (c) =>
        !q ||
        c.label.toLowerCase().includes(q) ||
        c.keywords.toLowerCase().includes(q) ||
        c.path.includes(q),
    );
    list.innerHTML = cmds
      .map(
        (c) => `
        <li>
          <button type="button" data-path="${c.path}" class="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-right text-sm text-white/85 hover:bg-white/10">
            ${c.label}
          </button>
        </li>
      `,
      )
      .join("");
    list.querySelectorAll("[data-path]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = btn.getAttribute("data-path");
        if (p) navigate(p);
        close();
      });
    });
  }

  input.addEventListener("input", () => renderList(input.value));
  root.addEventListener("click", (e) => {
    if (e.target === root) close();
  });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      root.classList.contains("open") ? close() : open();
    }
    if (e.key === "Escape" && root.classList.contains("open")) close();
  });
  document.getElementById("btn-palette-hint")?.addEventListener("click", open);
}

function setupPwaAndConnectivity() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  const liveBadge = document.getElementById("live-badge");
  const applyOnlineState = () => {
    const online = navigator.onLine;
    if (!liveBadge) return;
    liveBadge.textContent = online ? "بث مباشر" : "وضع بدون اتصال";
    liveBadge.classList.toggle("bg-emerald-500/15", online);
    liveBadge.classList.toggle("text-emerald-300", online);
    liveBadge.classList.toggle("ring-emerald-400/30", online);
    liveBadge.classList.toggle("bg-rose-500/15", !online);
    liveBadge.classList.toggle("text-rose-300", !online);
    liveBadge.classList.toggle("ring-rose-400/30", !online);
  };
  applyOnlineState();
  window.addEventListener("online", applyOnlineState);
  window.addEventListener("offline", applyOnlineState);
}

function setupAuthForm() {
  const form = document.getElementById("auth-form");
  const err = document.getElementById("auth-err");
  if (!form) return;
  const buttons = Array.from(form.querySelectorAll("button"));

  /**
   * @param {boolean} busy
   */
  const setBusy = (busy) => {
    buttons.forEach((btn) => {
      btn.disabled = busy;
      btn.classList.toggle("opacity-60", busy);
      btn.classList.toggle("cursor-not-allowed", busy);
    });
  };

  /**
   * @param {string} message
   * @param {"ok"|"error"} [kind]
   */
  const showAuthMessage = (message, kind = "error") => {
    if (!err) return;
    err.textContent = message;
    err.classList.remove("hidden", "text-rose-300", "text-emerald-300");
    err.classList.add(kind === "ok" ? "text-emerald-300" : "text-rose-300");
  };

  form.querySelector("[data-auth='signup']")?.addEventListener("click", async () => {
    const fd = new FormData(/** @type {HTMLFormElement} */ (form));
    const email = String(fd.get("email") || "").trim();
    const password = String(fd.get("password") || "");
    if (!password) {
      showAuthMessage("أدخل كلمة المرور لإنشاء حساب");
      return;
    }
    err?.classList.add("hidden");
    setBusy(true);
    try {
      await state.signUp(email, password);
      showAuthMessage("تم إنشاء الحساب. تحقق من بريدك لتأكيد الحساب ثم سجّل الدخول.", "ok");
    } catch (e) {
      showAuthMessage(e instanceof Error ? e.message : "فشل التسجيل");
    } finally {
      setBusy(false);
    }
  });

  form.querySelector("[data-auth='magic-link']")?.addEventListener("click", async () => {
    const fd = new FormData(/** @type {HTMLFormElement} */ (form));
    const email = String(fd.get("email") || "").trim();
    if (!email) {
      showAuthMessage("أدخل البريد الإلكتروني أولًا");
      return;
    }
    err?.classList.add("hidden");
    setBusy(true);
    try {
      await state.signInWithMagicLink(email);
      showAuthMessage("تم إرسال رابط الدخول. افتح البريد واضغط الرابط للمتابعة.", "ok");
    } catch (e) {
      showAuthMessage(e instanceof Error ? e.message : "فشل إرسال رابط الدخول");
    } finally {
      setBusy(false);
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(/** @type {HTMLFormElement} */ (form));
    const email = String(fd.get("email") || "").trim();
    const password = String(fd.get("password") || "");
    if (!password) {
      showAuthMessage("أدخل كلمة المرور أو استخدم زر Magic Link");
      return;
    }
    err?.classList.add("hidden");
    setBusy(true);
    try {
      await state.signIn(email, password);
    } catch (e) {
      showAuthMessage(e instanceof Error ? e.message : "فشل الدخول");
    } finally {
      setBusy(false);
    }
  });
}

async function init() {
  setupPwaAndConnectivity();
  applyTheme(getPreferredTheme());
  document.getElementById("btn-theme-toggle")?.addEventListener("click", () => {
    const next = document.body.classList.contains("theme-light") ? "dark" : "light";
    applyTheme(next);
  });

  // Mobile navigation drawer (open/close) — UI only.
  const navDrawer = document.getElementById("nav-drawer");
  const navOverlay = document.getElementById("nav-drawer-overlay");
  const btnNavToggle = document.getElementById("btn-nav-toggle");
  const btnNavClose = document.getElementById("btn-nav-close");
  let drawerOpen = false;

  function setDrawerOpen(open) {
    if (!navDrawer || !navOverlay) return;
    drawerOpen = open;
    btnNavToggle?.setAttribute("aria-expanded", open ? "true" : "false");
    navDrawer.classList.toggle("translate-x-0", open);
    navDrawer.classList.toggle("translate-x-full", !open);
    navOverlay.classList.toggle("hidden", !open);
    navOverlay.classList.toggle("opacity-0", !open);
    navOverlay.classList.toggle("opacity-100", open);
    navOverlay.classList.toggle("pointer-events-none", !open);
    navOverlay.classList.toggle("pointer-events-auto", open);
    document.body.classList.toggle("overflow-hidden", open);
  }

  btnNavToggle?.addEventListener("click", () => setDrawerOpen(!drawerOpen));
  btnNavClose?.addEventListener("click", () => setDrawerOpen(false));
  navOverlay?.addEventListener("click", () => setDrawerOpen(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawerOpen) setDrawerOpen(false);
  });

  const nav = document.getElementById("main-nav");
  renderNav();

  nav?.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-nav]");
    if (a) {
      e.preventDefault();
      const p = a.getAttribute("data-nav");
      if (p) {
        navigate(p);
        setDrawerOpen(false);
      }
    }
  });

  document.getElementById("btn-signout")?.addEventListener("click", () => state.signOut());

  // Theme customizer (per-user accent colors)
  const customModal = document.getElementById("theme-customizer");
  const customForm = document.getElementById("theme-customize-form");
  const btnThemeCustomize = document.getElementById("btn-theme-customize");
  const btnThemeCustomizeClose = document.getElementById("btn-theme-customize-close");
  const btnThemeCustomizeCancel = document.getElementById("btn-theme-customize-cancel");
  const btnThemeCustomizeReset = document.getElementById("btn-theme-customize-reset");

  function setCustomizerOpen(open) {
    if (!customModal) return;
    customModal.classList.toggle("opacity-0", !open);
    customModal.classList.toggle("opacity-100", open);
    customModal.classList.toggle("pointer-events-none", !open);
    customModal.classList.toggle("pointer-events-auto", open);
    document.body.classList.toggle("overflow-hidden", open);
  }

  function hydrateCustomizerInputs() {
    if (!customForm) return;
    const cs = getComputedStyle(document.documentElement);
    const current = loadCustomTheme();
    /** @type {HTMLInputElement|null} */
    const cCyan = customForm.querySelector("#color-cyan");
    const cViolet = customForm.querySelector("#color-violet");
    const cEmerald = customForm.querySelector("#color-emerald");
    const cRose = customForm.querySelector("#color-rose");
    if (cCyan) {
      const base = cs.getPropertyValue("--mony-cyan-rgb").trim();
      cCyan.value = current?.cyan ? rgbTupleToHex(current.cyan) : rgbTupleToHex(base);
    }
    if (cViolet) {
      const base = cs.getPropertyValue("--mony-violet-rgb").trim();
      cViolet.value = current?.violet ? rgbTupleToHex(current.violet) : rgbTupleToHex(base);
    }
    if (cEmerald) {
      const base = cs.getPropertyValue("--mony-emerald-rgb").trim();
      cEmerald.value = current?.emerald ? rgbTupleToHex(current.emerald) : rgbTupleToHex(base);
    }
    if (cRose) {
      const base = cs.getPropertyValue("--mony-rose-rgb").trim();
      cRose.value = current?.rose ? rgbTupleToHex(current.rose) : rgbTupleToHex(base);
    }
  }

  btnThemeCustomize?.classList.remove("hidden");
  btnThemeCustomize?.addEventListener("click", () => {
    hydrateCustomizerInputs();
    setCustomizerOpen(true);
  });
  btnThemeCustomizeClose?.addEventListener("click", () => setCustomizerOpen(false));
  btnThemeCustomizeCancel?.addEventListener("click", () => setCustomizerOpen(false));

  btnThemeCustomizeReset?.addEventListener("click", () => {
    localStorage.removeItem(CUSTOM_THEME_KEY);
    applyCustomTheme(null);
    hydrateCustomizerInputs();
  });

  customModal?.addEventListener("click", (e) => {
    if (e.target === customModal) setCustomizerOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setCustomizerOpen(false);
  });

  customForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    /** @type {HTMLInputElement|null} */
    const cCyan = customForm.querySelector("#color-cyan");
    const cViolet = customForm.querySelector("#color-violet");
    const cEmerald = customForm.querySelector("#color-emerald");
    const cRose = customForm.querySelector("#color-rose");
    /** @type {{ cyan?: string, violet?: string, emerald?: string, rose?: string }} */
    const next = {};
    const pushColor = (input, key) => {
      if (!input?.value) return;
      const tuple = hexToRgbTuple(input.value);
      if (!tuple) return;
      next[key] = tuple.join(", ");
    };
    pushColor(cCyan, "cyan");
    pushColor(cViolet, "violet");
    pushColor(cEmerald, "emerald");
    pushColor(cRose, "rose");
    localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(next));
    applyCustomTheme(next);
    setCustomizerOpen(false);
  });

  setupCommandPalette();
  setupAuthForm();

  function applyRoute() {
    const path = getRoute();
    if (path === ROUTES.ADMIN_USERS && !isStaffRole(state.getState().profile?.role)) {
      navigate(ROUTES.DASHBOARD);
      return;
    }
    if (path === ROUTES.ADD_EXPENSE) {
      const tx = getHashSearchParams().get("transaction_id");
      if (!tx || !isUuid(tx)) {
        navigate(ROUTES.TRANSACTIONS);
        return;
      }
    }
    if (matchTaskDetailPath(path)) {
      mountRoute(path);
      return;
    }
    if (matchTransactionDetailPath(path)) {
      mountRoute(path);
      return;
    }
    const p = path in routes ? path : ROUTES.DASHBOARD;
    if (p !== path) {
      navigate(p);
      return;
    }
    mountRoute(p);
  }

  state.subscribe("auth", (user) => {
    showApp(user);
    renderNav();
    setDrawerOpen(false);
    if (user) applyRoute();
  });

  state.subscribe("profile", () => {
    if (state.getState().sessionUser) renderNav();
  });

  state.subscribe("sync", (s) => {
    const liveBadge = document.getElementById("live-badge");
    if (!liveBadge) return;
    if (s?.running) {
      liveBadge.textContent = `مزامنة... (${s.pending ?? 0})`;
      return;
    }
    if (s?.queued) {
      liveBadge.textContent = `محفوظ محليًا (${s.pending ?? 0})`;
      return;
    }
    if (navigator.onLine) liveBadge.textContent = "بث مباشر";
  });

  await state.bootState();
  renderNav();

  // Apply any saved custom palette after base theme is ready.
  applyCustomTheme(loadCustomTheme());

  startRouter(() => {
    if (!state.getState().sessionUser) return;
    applyRoute();
  });
}

init().catch(console.error);
