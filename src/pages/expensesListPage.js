import { mountExpensesList } from "../views/expensesListView.js";
import * as state from "../state.js";
import { navigate } from "../router.js";

/**
 * @param {HTMLElement} container
 */
export function mount(container) {
  return mountExpensesList(container, {
    getState: state.getState,
    subscribe: state.subscribe,
    onDelete: (id) => state.removeExpense(id),
    navigate,
  });
}
