import { createContext } from 'react';

/**
 * What the signed-in user may reach, from `GET /api/my/pages`.
 *
 * Separate from AuthContext because auth state is read synchronously from
 * localStorage while this must be fetched — folding them together would make
 * every consumer of auth wait on a network round trip.
 */
export const AccessContext = createContext({
  modules: [],
  pages: [],
  isLoading: true,
  error: null,
  reload: () => {},
});
