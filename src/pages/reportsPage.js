import { mountReports } from "../views/reportsView.js";
import * as state from "../state.js";

/**
 * @param {HTMLElement} container
 */
export function mount(container) {
  return mountReports(container, {
    getState: state.getState,
    subscribe: state.subscribe,
    refresh: state.refreshReports,
  });
}
