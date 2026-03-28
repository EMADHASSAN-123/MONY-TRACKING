/**
 * @param {number} n
 * @param {string} [currency] رمز ISO (SAR / YER / AED)
 */
export function formatCurrency(n, currency = "SAR") {
  const v = Number(n);
  if (Number.isNaN(v)) return "—";
  try {
    return new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${v.toFixed(2)} ${currency}`;
  }
}

/**
 * @param {number} n
 * @param {string} [currency]
 * @param {string} [shortSuffix] مثل ر.س من constants.currencyShortLabel
 */
export function formatMoneyShort(n, currency = "SAR", shortSuffix) {
  const v = Number(n);
  if (Number.isNaN(v)) return "—";
  const suf = shortSuffix ? ` ${shortSuffix}` : "";
  return `${new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(v)}${suf}`;
}

/**
 * @param {string|Date} d
 */
export function formatDate(d) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d + (d.length === 10 ? "T12:00:00" : "")) : d;
  if (Number.isNaN(date.getTime())) return String(d);
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

/**
 * @param {string} isoDate YYYY-MM-DD
 */
export function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * @template T
 * @param {(...args: any[]) => T} fn
 * @param {number} ms
 */
export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/**
 * @param {HTMLElement} el
 * @param {string} html
 */
export function setHTML(el, html) {
  el.innerHTML = html;
}

/**
 * @param {Record<string, number>} buckets
 * @param {number} maxBars
 */
export function topSortedEntries(buckets, maxBars = 12) {
  return Object.entries(buckets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxBars);
}
