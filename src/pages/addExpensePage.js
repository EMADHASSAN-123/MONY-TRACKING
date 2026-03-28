import { mountAddExpense } from "../views/addExpenseView.js";
import * as state from "../state.js";
import { navigate, getHashSearchParams } from "../router.js";
import { ROUTES, isUuid } from "../utils/constants.js";

/**
 * @param {HTMLElement} container
 */
export function mount(container) {
  const params = getHashSearchParams();
  const txId = params.get("transaction_id") || "";
  if (!isUuid(txId)) {
    navigate(ROUTES.TRANSACTIONS);
    return () => {};
  }
  return mountAddExpense(container, {
    onSubmit: (row) => state.addExpense(row),
    getTransactions: () => state.getState().transactions,
    defaultTransactionId: txId,
    subscribe: state.subscribe,
    navigate,
  });
}
