import { apiGet } from './apiClient';

/**
 * The pages the signed-in user may open, grouped by module.
 *
 * Includes non-navigable pages: the sidebar filters those out, but the route
 * guard needs them — a project detail page has no link and must still be
 * reachable by the people who may open it.
 */
export const getMyPages = () => apiGet('/api/my/pages');
