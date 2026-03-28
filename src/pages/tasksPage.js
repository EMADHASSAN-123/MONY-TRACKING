import { mountTasks } from "../views/tasksView.js";
import * as state from "../state.js";
import * as tasksApi from "../api/tasks.js";
import * as adminApi from "../api/adminUsers.js";
import { navigate } from "../router.js";

/**
 * @param {HTMLElement} container
 * @param {string} [taskId]
 */
export function mount(container, taskId) {
  return mountTasks(container, {
    initialTaskId: taskId ?? null,
    getState: state.getState,
    subscribe: state.subscribe,
    navigate,
    listUsers: () => adminApi.listDirectoryUsers(),
    fetchTaskWithEvents: (id) => tasksApi.fetchTaskWithEvents(id),
    addTask: (row) => state.addTask(row),
    patchTask: (id, patch) => state.patchTask(id, patch),
    removeTask: (id) => state.removeTaskById(id),
    refreshTasks: () => state.refreshTasks({ silent: false }),
  });
}
