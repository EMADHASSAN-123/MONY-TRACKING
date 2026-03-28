import { mountDashboard } from "../views/dashboardView.js";
import * as state from "../state.js";
import { navigate } from "../router.js";

/**
 * @param {HTMLElement} container
 */
export function mount(container) {
  return mountDashboard(container, {
    subscribe: state.subscribe,
    getState: state.getState,
    navigate,
  });
}
