/**
 * @param {{ title: string, subtitle?: string, className?: string, body?: string, accent?: string }} opts
 */
export function cardHTML(opts) {
  const accent = opts.accent ?? "from-cyan-500/20 to-violet-500/10";
  return `
    <article class="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${accent} p-5 shadow-lg backdrop-blur-md transition duration-300 hover:border-white/20 hover:shadow-cyan-500/10">
      <div class="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5 blur-2xl transition group-hover:bg-white/10"></div>
      <header class="relative z-10 mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold tracking-wide text-white/90">${escapeHtml(opts.title)}</h3>
          ${opts.subtitle ? `<p class="mt-1 text-xs text-white/50">${escapeHtml(opts.subtitle)}</p>` : ""}
        </div>
      </header>
      <div class="relative z-10 text-white/90">${opts.body ?? ""}</div>
    </article>
  `;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {HTMLElement} el
 */
export function pulseHighlight(el) {
  el.classList.remove("mony-pulse");
  void el.offsetWidth;
  el.classList.add("mony-pulse");
}
