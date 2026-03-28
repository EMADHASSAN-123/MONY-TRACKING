import { mountTransactionsList } from "../views/transactionsListView.js";
import * as state from "../state.js";
import { navigate } from "../router.js";

/**
 * @param {HTMLElement} container
 */
export function mount(container) {
  return mountTransactionsList(container, {
    getState: state.getState,
    subscribe: state.subscribe,
    onDelete: (id) => state.removeTransaction(id),
    navigate,
  });
}
