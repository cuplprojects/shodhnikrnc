/**
 * Resolves a browser location to one of the user's pages.
 *
 * Routes carry React Router patterns (`/projects/:id/edit`), so a literal
 * comparison would fail for every detail page — which is most of the pages a
 * user reaches without a sidebar link.
 */

/**
 * Literal routes in App.jsx that sit alongside a same-shape `:param`
 * sibling -- e.g. `/projects/new` next to `/projects/:id`. Without this, a
 * user who holds the param page (`projects.detail`) but not the literal one
 * (`projects.new`) would have "new" silently accepted as a plausible `:id`
 * value: `matches()` cannot tell "new" apart from a real id by shape alone,
 * so the param route would wrongly claim the literal path and let the
 * route guard through. Listed explicitly rather than derived, since
 * `pages` only ever contains the pages *this* user holds -- there is no
 * "am I colliding with a page I don't have" signal to compute from that
 * alone. Keep in sync with App.jsx: any `/x/new` route declared next to an
 * `/x/:id` route of the same depth needs an entry here.
 */
const RESERVED_LITERAL_ROUTES = new Set(['/projects/new', '/proposals/new']);

/** Turns "/projects/:id/edit" into segments, marking the parameters. */
function segmentsOf(route) {
  return route.split('/').filter(Boolean).map((s) => ({
    isParam: s.startsWith(':'),
    value: s,
  }));
}

function matches(pathSegments, routeSegments) {
  if (pathSegments.length !== routeSegments.length) {
    return false;
  }
  return routeSegments.every((seg, i) => seg.isParam || seg.value === pathSegments[i]);
}

/**
 * The page whose route matches `pathname`, or null when none does.
 *
 * Prefers the most literal match: `/projects/new` and `/projects/:id` both
 * match "/projects/new", and resolving to the parameterised one would gate the
 * new-project page on the detail page's permission. A pathname reserved for a
 * literal route (see RESERVED_LITERAL_ROUTES) never falls through to a
 * `:param` sibling even when the user does not hold the literal page --
 * otherwise losing just the literal grant would silently let the param page
 * stand in for it.
 */
export function matchRoute(pathname, pages) {
  if (RESERVED_LITERAL_ROUTES.has(pathname) && !pages.some((p) => p.route === pathname)) {
    return null;
  }

  const pathSegments = pathname.split('/').filter(Boolean);

  const candidates = pages
    .map((page) => ({ page, segments: segmentsOf(page.route) }))
    .filter(({ segments }) => matches(pathSegments, segments));

  if (candidates.length === 0) {
    return null;
  }

  // Fewest parameters wins, so a literal segment beats a placeholder.
  candidates.sort(
    (a, b) =>
      a.segments.filter((s) => s.isParam).length - b.segments.filter((s) => s.isParam).length,
  );

  return candidates[0].page;
}

/**
 * Whether a location is governed by any known page.
 *
 * A route with no page at all — /login, /register, a typo — is not the access
 * system's business: it must not be treated as forbidden, or every unknown URL
 * would redirect instead of showing the app's own not-found handling.
 */
export function isGoverned(pathname, allPages) {
  return matchRoute(pathname, allPages) !== null;
}
