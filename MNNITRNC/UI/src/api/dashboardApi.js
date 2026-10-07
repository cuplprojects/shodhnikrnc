import { apiGet } from './apiClient';

/** JSON list of items awaiting the signed-in user's action, per the
 * backend's own per-request-type scoping (DashboardController). Each item:
 * { requestType, id, title, currentStage, createdAt, route }.
 */
export function getPendingActions() {
  return apiGet('/api/dashboard/pending-actions');
}
