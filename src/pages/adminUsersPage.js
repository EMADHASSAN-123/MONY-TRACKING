import { mountAdminUsers } from "../views/adminUsersView.js";
import * as state from "../state.js";
import * as adminApi from "../api/adminUsers.js";

/**
 * @param {HTMLElement} container
 */
export function mount(container) {
  return mountAdminUsers(container, {
    getState: state.getState,
    subscribe: state.subscribe,
    listUsers: () => adminApi.listDirectoryUsers(),
    createUser: (payload) => adminApi.createUserByAdmin(payload),
    updateRole: (uid, role) => adminApi.updateUserRole(uid, { role }),
  });
}
