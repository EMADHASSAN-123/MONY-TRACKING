import { formatCurrency, formatDate } from "./helpers.js";
import { currencyMeta } from "./constants.js";

/**
 * @param {import('../state.js').Transaction} tx
 * @param {import('../state.js').Expense[]} expenses
 */
export async function downloadTransferExcel(tx, expenses) {
  const XLSX = await import("https://esm.sh/xlsx@0.18.5");
  const cur = tx.currency || "SAR";
  const curLbl = currencyMeta(cur).labelShort;
  const transferRows = [
    ["الادارة المالية لمركز الشفاء القرأني — تصدير حوالة"],
    [],
    ["الحقل", "القيمة"],
    ["المعرف", tx.id],
    ["المرسل", tx.sender],
    ["المستفيد", tx.beneficiary],
    ["المبلغ", Number(tx.amount)],
    ["العملة", curLbl],
    ["التاريخ", tx.transaction_date],
    ["التصنيف", tx.category ?? ""],
    [],
    ["المصروفات المرتبطة"],
    ["الوصف", "المبلغ", "التاريخ", "التصنيف", "معرف المصروف"],
    ...expenses.map((e) => [
      e.description,
      Number(e.amount),
      e.expense_date,
      e.category ?? "",
      e.id,
    ]),
    [],
    ["إجمالي المصروفات", expenses.reduce((s, e) => s + Number(e.amount), 0)],
    ["المتبقي من الحوالة", Number(tx.amount) - expenses.reduce((s, e) => s + Number(e.amount), 0)],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(transferRows);
  ws["!cols"] = [{ wch: 28 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(wb, ws, "حوالة");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `healing-finance-transfer-${tx.id.slice(0, 8)}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * نافذة طباعة عربية RTL → المستخدم يحفظ كـ PDF من حوار الطباعة.
 * @param {import('../state.js').Transaction} tx
 * @param {import('../state.js').Expense[]} expenses
 */
export function openTransferPrintPdf(tx, expenses) {
  const cur = tx.currency || "SAR";
  const sumEx = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const remaining = Number(tx.amount) - sumEx;
  const exRows = expenses
    .map(
      (e) => `
    <tr>
      <td>${escapeHtml(e.description)}</td>
      <td class="num">${formatCurrency(Number(e.amount), cur)}</td>
      <td>${formatDate(e.expense_date)}</td>
      <td>${escapeHtml(e.category ?? "")}</td>
    </tr>`,
    )
    .join("");

  // Pass current theme tokens into the popup window so it stays consistent.
  const cs = getComputedStyle(document.documentElement);
  const cssVars = [
    "--mony-text-rgb",
    "--mony-panel-rgb",
    "--mony-cyan-rgb",
    "--mony-violet-rgb",
    "--mony-emerald-rgb",
    "--mony-rose-rgb",
  ]
  // "--mony-bg-rgb",
    .map((k) => `${k}:${cs.getPropertyValue(k).trim()}`)
    .join(";");

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <title>حوالة ${escapeHtml(tx.id.slice(0, 8))}</title>
  <style>
    :root{${cssVars}}
    body { font-family: 'Tajawal', 'Segoe UI', sans-serif; padding: 24px; }
    h1 { font-size: 18px; margin-bottom: 8px; }
    body { color: black; }
    .muted { color: rgba(var(--mony-text-rgb), 0.78); font-size: 12px; margin-bottom: 20px; }
    html, body { background: rgb(var(--mony-bg-rgb)); }
    * { -webkit-print-color-adjust: exact; color-adjust: exact; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid rgba(var(--mony-text-rgb), 0.28); padding: 8px 10px; font-size: 13px; }
    th { background: rgba(var(--mony-panel-rgb), 0.75); text-align: right; }
    td.num { text-align: left; direction: ltr; font-feature-settings: "tnum"; }
    .kv { margin: 12px 0; }
    .kv div { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(var(--mony-text-rgb), 0.18); }
    .summary { margin-top: 20px; font-weight: bold; }
    @media print {
      html, body { background: rgb(var(--mony-bg-rgb)); }
      body { padding: 0; }
    }
  </style>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
</head>
<body>
  <h1>تقرير حوالة — الادارة الرقمية المالية لمركز الشفاء القرأني</h1>
  <p class="muted">صُدر في ${new Date().toLocaleString("ar-SA")}</p>
  <div class="kv">
    <div><span>المرسل</span><span>${escapeHtml(tx.sender)}</span></div>
    <div><span>المستفيد</span><span>${escapeHtml(tx.beneficiary)}</span></div>
    <div><span>مبلغ الحوالة</span><span>${formatCurrency(Number(tx.amount), cur)}</span></div>
    <div><span>تاريخ الحوالة</span><span>${formatDate(tx.transaction_date)}</span></div>
    <div><span>التصنيف</span><span>${escapeHtml(tx.category ?? "")}</span></div>
  </div>
  <h2 style="font-size:15px;margin-top:24px">سحبيات/مصروفات الحوالة   (${expenses.length})</h2>
  <table>
    <thead><tr><th>الوصف</th><th>المبلغ</th><th>التاريخ</th><th>التصنيف</th></tr></thead>
    <tbody>${exRows || "<tr><td colspan='4' style='text-align:center'>لا مصروفات</td></tr>"}</tbody>
  </table>
  <div class="summary">
    <div>إجمالي المصروفات: ${formatCurrency(sumEx, cur)}</div>
    <div>المتبقي: ${formatCurrency(remaining, cur)}</div>
  </div>
  <script>window.onload=function(){window.focus();window.print();}</script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
