/**
 * @param {unknown} v
 * @returns {string|null}
 */
export function requiredString(v, fieldName = "الحقل") {
  const s = typeof v === "string" ? v.trim() : String(v ?? "").trim();
  if (!s) return `${fieldName} مطلوب`;
  return null;
}

/**
 * @param {unknown} v
 * @returns {string|null}
 */
export function positiveAmount(v, fieldName = "المبلغ") {
  const n = Number(v);
  if (Number.isNaN(n) || n <= 0) return `${fieldName} يجب أن يكون رقماً موجباً`;
  return null;
}

/**
 * @param {unknown} v
 * @returns {string|null}
 */
export function isoDate(v, fieldName = "التاريخ") {
  const s = typeof v === "string" ? v.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${fieldName} بصيغة YYYY-MM-DD`;
  return null;
}

/**
 * @param {Record<string, unknown>} fields
 */
/**
 * @param {unknown} v
 * @returns {string|null}
 */
export function currencyCode(v, fieldName = "العملة") {
  const allowed = new Set(["SAR", "YER", "AED"]);
  const s = String(v ?? "SAR").trim().toUpperCase();
  if (!allowed.has(s)) return `${fieldName} غير صالحة`;
  return null;
}

/**
 * @param {unknown} v
 * @returns {string|null}
 */
export function requiredUuid(v, fieldName = "المعرف") {
  const s = typeof v === "string" ? v.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) {
    return `${fieldName} مطلوب وبصيغة UUID`;
  }
  return null;
}

export function validateTransaction(fields) {
  const errs = [];
  const e1 = requiredString(fields.sender, "المرسل");
  const e2 = requiredString(fields.beneficiary, "المستفيد");
  const e3 = positiveAmount(fields.amount);
  const e4 = isoDate(fields.transaction_date ?? fields.transactionDate);
  const e5 = currencyCode(fields.currency ?? fields.currencyCode);
  [e1, e2, e3, e4, e5].forEach((e) => e && errs.push(e));
  return errs;
}

/**
 * @param {Record<string, unknown>} fields
 */
export function validateExpense(fields) {
  const errs = [];
  const e1 = requiredString(fields.description, "الوصف");
  const e2 = positiveAmount(fields.amount);
  const e3 = isoDate(fields.expense_date ?? fields.expenseDate);
  const e4 = requiredUuid(fields.transaction_id ?? fields.transactionId, "الحوالة");
  [e1, e2, e3, e4].forEach((e) => e && errs.push(e));
  return errs;
}
