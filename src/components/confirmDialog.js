/**
 * نافذة تأكيد مع انتقال بسيط ودعم لوحة المفاتيح (Escape = إلغاء).
 * @param {{
 *   title?: string,
 *   message: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   danger?: boolean,
 * }} opts
 * @returns {Promise<boolean>}
 */
export function confirmDialog(opts) {
  const title = opts.title ?? "تأكيد";
  const message = String(opts.message || "");
  const confirmLabel = opts.confirmLabel ?? "تأكيد";
  const cancelLabel = opts.cancelLabel ?? "إلغاء";
  const danger = opts.danger !== false;

  return new Promise((resolve) => {
    let settled = false;
    const wrap = document.createElement("div");
    wrap.className = "fixed inset-0 z-[250] flex items-center justify-center p-4 sm:p-6";
    wrap.setAttribute("role", "alertdialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-labelledby", "mony-confirm-title");
    wrap.setAttribute("aria-describedby", "mony-confirm-desc");

    const yesClass = danger
      ? "rounded-xl bg-rose-600/85 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
      : "rounded-xl bg-cyan-600/85 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-sm transition hover:bg-cyan-500/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50";

    wrap.innerHTML = `
      <div data-confirm-backdrop class="absolute inset-0 bg-zinc-950/65 backdrop-blur-[2px] transition-opacity duration-200 ease-out opacity-0"></div>
      <div data-confirm-panel class="relative z-10 w-full max-w-[min(100%,22rem)] translate-y-1 scale-[0.97] transform rounded-2xl border border-white/10 bg-zinc-900/95 p-6 shadow-2xl shadow-black/40 transition-all duration-200 ease-out opacity-0 will-change-transform">
        <h2 id="mony-confirm-title" class="text-base font-semibold tracking-tight text-white/95"></h2>
        <p id="mony-confirm-desc" class="mt-3 text-sm leading-relaxed text-white/55"></p>
        <div class="mt-6 flex flex-wrap justify-end gap-2.5">
          <button type="button" data-confirm-no class="rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm text-white/75 transition hover:border-white/18 hover:bg-white/[0.08] hover:text-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"></button>
          <button type="button" data-confirm-yes class="${yesClass}"></button>
        </div>
      </div>
    `;

    wrap.querySelector("#mony-confirm-title").textContent = title;
    wrap.querySelector("#mony-confirm-desc").textContent = message;
    /** @type {HTMLButtonElement} */ (wrap.querySelector("[data-confirm-no]")).textContent = cancelLabel;
    /** @type {HTMLButtonElement} */ (wrap.querySelector("[data-confirm-yes]")).textContent = confirmLabel;

    const backdrop = wrap.querySelector("[data-confirm-backdrop]");
    const panel = wrap.querySelector("[data-confirm-panel]");
    const btnNo = /** @type {HTMLButtonElement} */ (wrap.querySelector("[data-confirm-no]"));
    const btnYes = /** @type {HTMLButtonElement} */ (wrap.querySelector("[data-confirm-yes]"));

    const finish = (v) => {
      if (settled) return;
      settled = true;
      backdrop?.classList.remove("opacity-100");
      backdrop?.classList.add("opacity-0");
      panel?.classList.remove("translate-y-0", "scale-100", "opacity-100");
      panel?.classList.add("translate-y-1", "scale-[0.97]", "opacity-0");
      document.removeEventListener("keydown", onKey);
      setTimeout(() => {
        wrap.remove();
        resolve(v);
      }, 190);
    };

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    };

    btnNo.addEventListener("click", () => finish(false));
    btnYes.addEventListener("click", () => finish(true));
    backdrop?.addEventListener("click", () => finish(false));
    document.addEventListener("keydown", onKey);

    document.body.appendChild(wrap);
    requestAnimationFrame(() => {
      backdrop?.classList.add("opacity-100");
      panel?.classList.remove("translate-y-1", "scale-[0.97]", "opacity-0");
      panel?.classList.add("translate-y-0", "scale-100", "opacity-100");
    });

    btnNo.focus();
  });
}
