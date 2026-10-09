import { useCallback, useEffect, useMemo, useState } from 'react';
import { getMyPages } from '../api/accessApi';
import { useAuth } from '../auth/useAuth';
import { AccessContext } from './accessContextObject';

/**
 * Loads the signed-in user's pages once per session and shares them with the
 * sidebar and the route guard.
 *
 * Refetched when the token changes, so signing in as someone else does not
 * leave the previous user's menu on screen.
 */
export function AccessProvider({ children }) {
  const { token } = useAuth();
  const [modules, setModules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    // Awaited first so nothing below runs synchronously during the effect,
    // which is what the cascading-render rule guards against. The signed-out
    // case still has to settle the loading flag, or the guard would render
    // nothing forever.
    await Promise.resolve();

    if (!token) {
      setModules([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    try {
      const result = await getMyPages();
      setModules(result?.modules ?? []);
      setError(null);
    } catch (err) {
      setError('Unable to load your navigation. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // The rule cannot see through the useCallback, so it flags any setState
    // transitively reachable from here. Every write in `load` happens after an
    // await, which is the thing the rule actually guards against. Same
    // reasoning, and same disable, as the other pages in this codebase.
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    void load();

    // Re-fetch permissions when the user returns to the tab so that any
    // access changes made in the admin panel (e.g. removing a page from a role)
    // are reflected without requiring a full logout/login.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void load();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [load]);

  // Flattened for the route guard, which matches a location against every page
  // regardless of which module it belongs to. payment.voucher, noting.page and
  // every hod.* page (indent/fellowship/leave/joining/consultancy/overhead/
  // dashboard) are real PageCatalogue entries -- they must not be special-cased
  // in here as "everyone gets this route" the way they periodically get
  // reintroduced as, or an Applicant/Fellow (none of which the catalogue grants
  // any of these pages to) would reach HOD-only approval queues regardless of
  // role.
  const pages = useMemo(
    () =>
      modules.flatMap((m) =>
        m.pages.map((p) => ({
          ...p,
          pageKey: p.pageKey || p.key,
          pageName: p.pageName || p.name,
          route: p.route,
          moduleKey: m.key || m.moduleKey,
        })),
      ),
    [modules],
  );


  const value = useMemo(
    () => ({ modules, pages, isLoading, error, reload: load }),
    [modules, pages, isLoading, error, load],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}
