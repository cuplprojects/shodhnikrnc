import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { useAccess } from '../access/useAccess';
import { matchRoute } from '../access/matchRoute';

const COMPLETE_PROFILE_PATH = '/complete-profile';
const REGISTRATION_PENDING_PATH = '/registration-pending';

/**
 * Requires a signed-in user, and that the location is one of their pages.
 *
 * The page check is new in Phase 8. Before it, the sidebar hid links but the
 * routes themselves were open: anyone signed in could reach any page by typing
 * its URL. The API refused the data, so nothing leaked, but the user got a
 * broken screen instead of a clear refusal.
 */
export default function ProtectedRoute({ children }) {
  const { token, user, isLoading: authLoading } = useAuth();
  const { pages, isLoading: accessLoading, error } = useAccess();
  const location = useLocation();

  if (authLoading) {
    return null;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Every internal role must complete their profile before reaching any
  // other page -- checked before the page-access lookup below, since
  // /complete-profile itself deliberately has no page-access grant (it
  // must always be reachable, for every role, with no admin setup).
  if (user?.profileComplete === false && location.pathname !== COMPLETE_PROFILE_PATH) {
    return <Navigate to={COMPLETE_PROFILE_PATH} replace />;
  }

  // A self-registered PI holding only the Pending role has nothing to do but
  // wait for HOD/Office review. Checked by exact role match, not
  // .includes('Pending'), so a hypothetical account that also holds a real
  // role is never incorrectly bounced here.
  const isPendingOnly = user?.roles?.length === 1 && user.roles[0] === 'Pending';
  if (isPendingOnly && location.pathname !== REGISTRATION_PENDING_PATH) {
    return <Navigate to={REGISTRATION_PENDING_PATH} replace />;
  }

  // Render nothing rather than redirecting while the pages are in flight.
  // Deciding on an empty list would bounce every user off pages they hold.
  if (accessLoading) {
    return null;
  }

  // If access could not be loaded at all, fall back to letting the router
  // through. The API still refuses the data, so this fails visible rather than
  // locking everyone out of the application over one failed request.
  if (error) {
    return children ?? <Outlet />;
  }

  // /complete-profile deliberately has no PageCatalogue grant -- it must be
  // reachable by every role with no admin setup, before any other page-access
  // check can apply.
  if (location.pathname === COMPLETE_PROFILE_PATH) {
    return children ?? <Outlet />;
  }

  const page = matchRoute(location.pathname, pages);

  if (page) {
    return children ?? <Outlet />;
  }

  // A location no page claims is either forbidden or unknown. Both land on the
  // dashboard, which every signed-in user holds.
  if (location.pathname === '/dashboard') {
    return children ?? <Outlet />;
  }

  return <Navigate to="/dashboard" replace state={{ deniedFrom: location.pathname }} />;
}
