/**
 * Formats an actor's display name using name and employee ID.
 * If name is missing, falls back to "Actor #fallbackId". Otherwise, appends
 * the employeeId if available: "Name (EmployeeId)" or just "Name".
 *
 * @param {string|null} name - The actor's display name
 * @param {string|null} employeeId - The actor's employee ID
 * @param {string|null} fallbackId - Fallback ID if name is not available
 * @returns {string} Formatted display string: "Name (EmployeeId)", "Name", or "Actor #fallbackId"
 */
export function formatActor(name, employeeId, fallbackId) {
  if (!name) return `Actor #${fallbackId}`;
  return employeeId ? `${name} (${employeeId})` : name;
}
