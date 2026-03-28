/**
 * @param {{ id: string, title: string, contentHTML: string }} opts
 */
export function createModalShell(opts) {
  const wrap = document.createElement("div");
  wrap.id = opts.id;
  wrap.className =
    "fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 opacity-0 pointer-events-none transition-opacity duration-200";
  wrap.innerHTML = `
    <div class="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950/95 p-6 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl" role="dialog" aria-modal="true">
      <button type="button" data-close class="absolute left-4 top-4 rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white" aria-label="إغلاق">✕</button>
      <h2 class="mb-4 pr-10 text-lg font-bold text-white">${opts.title}</h2>
      <div data-modal-body>${opts.contentHTML}</div>
    </div>
  `;
  return wrap;
}

/** @param {HTMLElement} modalRoot */
export function openModal(modalRoot) {
  modalRoot.classList.remove("opacity-0", "pointer-events-none");
  modalRoot.classList.add("opacity-100");
  const closeBtn = modalRoot.querySelector("[data-close]");
  closeBtn?.addEventListener("click", () => closeModal(modalRoot), { once: true });
  modalRoot.addEventListener(
    "click",
    (e) => {
      if (e.target === modalRoot) closeModal(modalRoot);
    },
    { once: true },
  );
}

/** @param {HTMLElement} modalRoot */
export function closeModal(modalRoot) {
  modalRoot.classList.add("opacity-0", "pointer-events-none");
  modalRoot.classList.remove("opacity-100");
}
