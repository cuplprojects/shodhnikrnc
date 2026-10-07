export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:7054';

/**
 * A full/absolute document URL (e.g. from documentDownloadPath, which already
 * prepends BASE_URL) reduced back to the path apiGet/apiBlob/etc. expect --
 * callers of those functions prepend BASE_URL themselves, so passing one
 * through unreduced double-prepends it.
 *
 * Stripping only the origin (scheme+host) is not enough whenever BASE_URL
 * itself has a path segment, e.g. VITE_API_BASE_URL=https://host/API in
 * production (local dev's https://localhost:7054 has none, which is why this
 * class of bug only shows up once deployed): origin-only stripping leaves
 * "/API" in the remainder, and the caller's own apiBlob(path) call then
 * prepends BASE_URL a second time, producing a doubled "/API/API/..." 404.
 */
export function stripBaseUrl(url) {
  if (url.startsWith(BASE_URL)) {
    return url.slice(BASE_URL.length);
  }
  return url.replace(/^https?:\/\/[^/]+/, '');
}

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
}

export function clearAuthToken() {
  authToken = null;
}

// ─── User-Friendly Message Mapping ────────────────────────────────────────────
// Maps the `title` field from ProblemDetails to a clear, actionable message.
// The API's title is a stable, code-level string (never contains GUIDs/IDs),
// so it is safe and reliable to use as a lookup key.
const TITLE_TO_MESSAGE = {
  // --- Auth ---
  'Email not verified':
    'Please verify your email address before applying. Check your inbox for the verification link.',

  // --- Recruitment lifecycle ---
  'Grant payment required':
    'The offer letter cannot be issued yet. A grant payment must first be received and its bank transaction reference recorded for this project.',
  'Recruitment not found':
    'This recruitment record could not be found. It may have been deleted or you may have an incorrect link.',
  'Candidate not found':
    'The applicant could not be found. Please refresh the page and try again.',
  'Application not submitted':
    'This applicant has not yet submitted their application and cannot be processed.',
  'Candidate not eligible to join':
    'This candidate is not eligible to join. They must be the selected candidate and not already appointed.',
  'No candidate selected':
    'No candidate has been selected yet. Please finalise the merit list and selection before proceeding.',
  'Invalid committee composition':
    'The committee roster is incomplete or incorrectly composed. Please review the committee members and try again.',
  'Dean approval required':
    'Online interviews require prior approval from the Dean. Please request Dean approval before changing the interview mode to Online.',
  'Invalid recruitment stage':
    'This action cannot be performed at the current stage of the recruitment process. Please check the workflow and try again.',
  'Advertisement not submitted':
    'No advertisement approval is in progress. Please generate and submit the advertisement first.',
  'Online interview not approved':
    'An online interview requires prior approval from the Dean. Please request approval first.',

  // --- Applications (candidate-facing) ---
  'Already applied':
    'You have already applied for this position. Only one application per position is allowed.',
  'Application draft not found':
    'Your application draft could not be found. It may have expired. Please start a new application.',
  'Access denied':
    'You do not have access to this resource.',
  'Already submitted':
    'This application has already been submitted and can no longer be edited.',
  'Application incomplete':
    'Your application is incomplete. Please fill in all required fields before submitting.',
  'Prefill source not permitted':
    'You can only use your own previous applications to prefill a new one.',

  // --- Advertisement templates ---
  'Advertisement template not found':
    'The selected advertisement template could not be found. It may have been deleted.',
  'Template not owned':
    'You can only edit templates that you have created.',
  'Cannot edit system default template':
    'The default system template cannot be modified. You can create your own template instead.',

  // --- Committees & signing ---
  'Committee member not found':
    'The committee member could not be found. Please refresh the page.',
  'Not the committee member':
    'Only the designated committee member can sign on their own behalf.',
  'Invalid signing token':
    'This signing link is invalid, has already been used, or has expired. Please contact the PI to get a new link.',

  // --- Projects & budget ---
  'Insufficient budget':
    'The requested amount exceeds the available budget for this project.',
  'Exceeds sanctioned budget':
    'The total grant amount would exceed the project\'s sanctioned budget.',
  'Received before submission':
    'The grant receipt date cannot be earlier than the project submission date.',
  'Exceeds received amount':
    'The reappropriation amount exceeds the total grant received for this project.',

  // --- Proposals ---
  'Proposal not found':
    'This proposal could not be found. It may have been deleted or the link is incorrect.',
  'Invalid proposal status':
    'This action cannot be performed because the proposal is not in the correct status.',
  'Cannot undo':
    'This action cannot be undone at this stage.',

  // --- Procurement ---
  'Indent not found':
    'This indent could not be found. It may have been deleted.',
  'Invalid budget year count':
    'The number of budget years specified is invalid for this project type.',
  'Bidding tier not supported':
    'The selected bidding tier is not supported for this type of purchase.',

  // --- Travel ---
  'Travel request not found':
    'This travel request could not be found.',
  'Taxi reimbursement not opted in':
    'This request has not opted in for taxi reimbursement.',

  // --- Fellowship / Leave ---
  'Fellowship claim not found':
    'This fellowship claim could not be found.',
  'Claim already approved':
    'This claim has already been approved and cannot be modified.',
  'Claim already exists':
    'A claim for this period has already been submitted.',
  'Claim already vouchered':
    'This fellowship claim has already been included in a payment voucher.',
  'Claim not approved':
    'This fellowship claim cannot be vouchered until it reaches final approval.',
  'HRA slip required':
    'A House Rent Allowance slip must be attached before submitting this claim.',
  'Claim outside tenure':
    'The claim period is outside your active tenure dates.',
  'Leave request not found':
    'This leave request could not be found.',
  'Insufficient leave balance':
    'You do not have enough leave balance for the requested duration.',
  'Leave outside tenure':
    'The requested leave dates are outside your active tenure period.',
  'Purpose required':
    'A purpose or reason must be provided for this type of leave.',
  'HRA override not permitted':
    'You do not have permission to override the HRA amount.',

  // --- Documents & departments ---
  'Document not found':
    'The requested document could not be found.',
  'Not authorized':
    'You do not have permission to perform this action on this document.',
  'Funding agency not found':
    'The funding agency could not be found.',
  'Funding agency already exists':
    'A funding agency with this name already exists.',
  'Department not found':
    'The department could not be found.',
  'Department code already exists':
    'A department with this code already exists.',
  'No department':
    'Your profile does not have a department assigned. Please contact the administrator.',

  // --- Workflow ---
  'Changed by someone else':
    'Someone else updated this record at the same time. Please refresh the page and try again.',
  'Cannot undo stage':
    'This workflow stage cannot be reversed.',

  // --- Notifications / email ---
  'Email is not configured':
    'The email notification system is not set up yet. Please contact the system administrator.',

  // --- ID card / fellow ---
  'ID card not issued':
    'Your ID card has not been issued yet. Please contact the office.',
  'Not a fellow':
    'This action is only available to active fellows with a valid appointment.',

  // --- Access / auth ---
  'Candidate draft not owned':
    'You do not have access to this application draft.',
};

/**
 * Maps a ProblemDetails response to a user-friendly message.
 * Priority: known-title mapping → sanitised detail → status-based fallback.
 */
function toUserMessage(status, problemDetails) {
  const message = problemDetails?.message ?? '';
  const title = problemDetails?.title ?? '';
  const detail = problemDetails?.detail ?? '';
  const errors = problemDetails?.errors;

  if (message && typeof message === 'string') {
    return message;
  }

  if (errors && typeof errors === 'object') {
    const errorList = Object.values(errors).flat().filter(Boolean);
    if (errorList.length > 0) return errorList.join(', ');
  }

  // Prefer a known, human-authored mapping for the title
  if (title && TITLE_TO_MESSAGE[title]) {
    return TITLE_TO_MESSAGE[title];
  }

  let candidate = detail || title;
  if (candidate) {
    // Strip ASP.NET exception prefix like "System.ArgumentException: " or "System.InvalidOperationException: "
    candidate = candidate.replace(/^System\.[a-zA-Z0-9_]+\.\w+Exception:\s*/i, '')
                         .replace(/^System\.[a-zA-Z0-9_]+Exception:\s*/i, '')
                         .replace(/^[a-zA-Z0-9_]+Exception:\s*/i, '')
                         .replace(/^\$?\.[A-Za-z]+:\s*/g, '')
                         .trim();
  }

  const guidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const technicalTerms = /sql|database|foreign key|constraint|stack trace|entity\s+framework|\bef\b|dbcontext/i;

  if (candidate && !guidRegex.test(candidate) && !technicalTerms.test(candidate)) {
    return candidate;
  }

  // If all else fails, use a generic status-based message
  switch (status) {
    case 400: return 'The information provided is invalid. Please check your input and try again.';
    case 401: return 'Your session has expired. Please sign in again.';
    case 403: return 'You do not have permission to perform this action.';
    case 404: return 'The requested information could not be found.';
    case 409: return 'This action conflicts with the current state. Please refresh the page and try again.';
    case 422: return 'Some fields are invalid. Please review your input.';
    case 429: return 'Too many requests. Please wait a moment and try again.';
    case 503: return 'A required service is temporarily unavailable. Please contact the administrator.';
    default:  return 'Something went wrong on our end. Please try again. If the problem persists, contact support.';
  }
}

export class ApiError extends Error {
  /**
   * @param {number} status - HTTP status code
   * @param {object|null} problemDetails - Parsed problem+json body
   * @param {object} [options]
   * @param {boolean} [options.silent=false] - If true, do not show a global toast.
   *   Use this for pages that handle their own inline error display (e.g., the login form).
   */
  constructor(status, problemDetails, options = {}) {
    const safeMessage = toUserMessage(status, problemDetails);
    super(safeMessage);
    this.status = status;
    this.problemDetails = problemDetails;

    if (!options.silent) {
      // Dispatch the global toast event — ToastContext deduplicates identical messages
      window.dispatchEvent(new CustomEvent('show-global-toast', {
        detail: { message: safeMessage, severity: 'error' }
      }));
    }
  }
}

async function request(method, path, body, options = {}) {
  const headers = {};
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // bearerToken overrides the stored RNC session token for one call -- used
  // only by the federated Faculty registration call, which must authenticate
  // with the Shodhanik token the user arrived on, not whatever RNC token (if
  // any, and possibly stale) happens to be stored.
  const bearer = options.bearerToken ?? authToken;
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
  });

  if (!response.ok) {
    let problemDetails = null;
    try {
      problemDetails = await response.json();
    } catch {
      // response body wasn't JSON (e.g. empty 401) — problemDetails stays null
    }
    throw new ApiError(response.status, problemDetails, options);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const apiGet = (path, options) => request('GET', path, undefined, options);
export const apiPost = (path, body, options) => request('POST', path, body, options);
export const apiPut = (path, body, options) => request('PUT', path, body, options);
export const apiDelete = (path, options) => request('DELETE', path, undefined, options);

/**
 * For endpoints that take a JSON body but return plain text/HTML rather
 * than JSON (e.g. a rendered document preview). Errors still arrive as
 * problem+json, so those are parsed the same way and surface as an ApiError
 * with a readable message.
 */
export async function apiPostText(path, body, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let problemDetails = null;
    try {
      problemDetails = await response.json();
    } catch {
      // Not JSON; ApiError falls back to a status-based message.
    }
    throw new ApiError(response.status, problemDetails, options);
  }

  return response.text();
}

/**
 * For endpoints returning a file rather than JSON. Errors still arrive as
 * problem+json, so those are parsed the same way and surface as an ApiError
 * with a readable message.
 */
export async function apiBlob(path, options = {}) {
  const headers = {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, { method: 'GET', headers });

  if (!response.ok) {
    let problemDetails = null;
    try {
      problemDetails = await response.json();
    } catch {
      // Not JSON; ApiError falls back to a status-based message.
    }
    throw new ApiError(response.status, problemDetails, options);
  }

  return response.blob();
}
