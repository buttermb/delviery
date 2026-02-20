/**
 * Sidebar Route Active State Matching
 *
 * Properly matches sidebar item paths (which may include query params like ?tab=X)
 * against the current browser location.
 */

/**
 * Check if a sidebar item's path matches the current location.
 * Handles paths with query parameters (e.g., /admin/orders?tab=wholesale).
 *
 * @param itemPath - The sidebar item's configured path (may include ?query params)
 * @param tenantSlug - Current tenant slug
 * @param locationPathname - Current location.pathname (no query string)
 * @param locationSearch - Current location.search (e.g., "?tab=live")
 * @returns true if the item should be considered active
 */
export function isRouteActive(
  itemPath: string,
  tenantSlug: string,
  locationPathname: string,
  locationSearch: string
): boolean {
  // Separate pathname from query params in the item's configured path
  const questionIdx = itemPath.indexOf('?');
  const itemPathname = questionIdx >= 0 ? itemPath.substring(0, questionIdx) : itemPath;
  const itemSearchStr = questionIdx >= 0 ? itemPath.substring(questionIdx) : '';

  const fullItemPathname = `/${tenantSlug}${itemPathname}`;

  // Step 1: pathname must match (exact or prefix with /)
  const pathnameMatch =
    locationPathname === fullItemPathname ||
    locationPathname.startsWith(fullItemPathname + '/');
  if (!pathnameMatch) return false;

  // Step 2: If item specifies query params, they must all be present in current URL
  if (itemSearchStr) {
    const itemParams = new URLSearchParams(itemSearchStr);
    const currentParams = new URLSearchParams(locationSearch);
    for (const [key, value] of itemParams.entries()) {
      if (currentParams.get(key) !== value) return false;
    }
    return true;
  }

  // Step 3: Item has no query params — active on pathname match
  return true;
}

/**
 * Count the number of query parameters in a sidebar item path.
 * Used for specificity ranking when multiple items match.
 */
export function getRouteSpecificity(itemPath: string): number {
  const questionIdx = itemPath.indexOf('?');
  if (questionIdx < 0) return 0;
  return new URLSearchParams(itemPath.substring(questionIdx)).size;
}

/**
 * Given an array of active states and item paths, resolve conflicts so that
 * only the most specific match(es) remain active.
 *
 * For example, if both "/admin/orders" (0 params) and "/admin/orders?tab=wholesale"
 * (1 param) are active, only the latter stays active.
 */
export function resolveMostSpecificActive(
  items: Array<{ path: string }>,
  activeStates: boolean[]
): boolean[] {
  const activeCount = activeStates.filter(Boolean).length;
  if (activeCount <= 1) return activeStates;

  // Find the highest specificity among active items
  let maxSpecificity = 0;
  for (let i = 0; i < items.length; i++) {
    if (activeStates[i]) {
      const spec = getRouteSpecificity(items[i].path);
      if (spec > maxSpecificity) maxSpecificity = spec;
    }
  }

  // Only keep items at the highest specificity level
  return activeStates.map((active, i) => {
    if (!active) return false;
    return getRouteSpecificity(items[i].path) === maxSpecificity;
  });
}
