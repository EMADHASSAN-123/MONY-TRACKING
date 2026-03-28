import { mountTransactionDetail } from "../views/transactionDetailView.js";
import * as state from "../state.js";
import { navigate } from "../router.js";

/**
 * @param {HTMLElement} container
 * @param {string} transactionId
 */
export function mount(container, transactionId) {
  return mountTransactionDetail(container, transactionId, {
    getState: state.getState,
    subscribe: state.subscribe,
    navigate,
    onDeleteExpense: (id) => state.removeExpense(id),
    onDeleteTransaction: (id) => state.removeTransaction(id),
  });
}
