import { mountAddTransaction } from "../views/addTransactionView.js";
import * as state from "../state.js";

/**
 * @param {HTMLElement} container
 */
export function mount(container) {
  return mountAddTransaction(container, {
    onSubmit: (row) => state.addTransaction(row),
  });
}
