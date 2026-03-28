const QUEUE_KEY = "mony-offline-queue-v1";

/**
 * @typedef {{
 *   id: string;
 *   type: "createTransaction"|"deleteTransaction"|"createExpense"|"deleteExpense";
 *   payload: Record<string, unknown>;
 *   createdAt: number;
 * }} OfflineJob
 */

/** @returns {OfflineJob[]} */
export function readQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @param {OfflineJob[]} jobs */
export function writeQueue(jobs) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(jobs));
}

/** @param {OfflineJob["type"]} type @param {Record<string, unknown>} payload */
export function enqueueJob(type, payload) {
  const jobs = readQueue();
  const job = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    payload,
    createdAt: Date.now(),
  };
  jobs.push(job);
  writeQueue(jobs);
  return job;
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export function removeJobById(id) {
  const next = readQueue().filter((j) => j.id !== id);
  writeQueue(next);
}
