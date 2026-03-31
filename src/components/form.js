/**
 * @param {{ id: string, label: string, type?: string, placeholder?: string, value?: string, required?: boolean, step?: string, className?: string }} f
 */
export function fieldHTML(f) {
  const type = f.type ?? "text";
  const req = f.required ? "required" : "";
  return `
    <label class="block ${f.className ?? ""}" for="${f.id}">
      <span class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/50">${f.label}</span>
      <input
        id="${f.id}"
        name="${f.id}"
        type="${type}"
        placeholder="${f.placeholder ?? ""}"
        value="${f.value ?? ""}"
        step="${f.step ?? ""}"
        ${req}
        class="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none ring-cyan-400/0 transition focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/30"
      />
    </label>
  `;
}

/**
 * @param {HTMLFormElement} form
 */
export function getFormData(form) {
  const fd = new FormData(form);
  /** @type {Record<string, string>} */
  const o = {};
  fd.forEach((v, k) => {
    o[k] = String(v);
  });
  return o;
}
 
/**
 * @param {HTMLElement} form
 * @param {string} message
 * @param {"error"|"ok"} kind
 */
const messageTimers = new WeakMap();

export function showFormMessage(form, message, kind = "error", duration = 3000) {
  let el = form.querySelector("[data-form-message]");

  if (!el) {
    el = document.createElement("p");
    el.setAttribute("data-form-message", "");
    el.className = "mt-3 text-sm";
    form.appendChild(el);
  }

  // إلغاء أي مؤقت سابق لهذا الفورم
  if (messageTimers.has(form)) {
    clearTimeout(messageTimers.get(form));
  }

  el.textContent = message;

  el.className =
    kind === "error"
      ? "mt-3 text-sm text-rose-300"
      : "mt-3 text-sm text-emerald-300";

  if (message) {
    const timer = setTimeout(() => {
      el.textContent = "";
      el.style.display = "none";
    }, duration);

    messageTimers.set(form, timer);
    el.style.display = "block";
  }
}