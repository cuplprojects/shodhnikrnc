# Phase 2 Frontend: Projects/Grants Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the React frontend for the Projects/Grants vertical slice — starting from the bare Vite scaffold, this bootstraps app-wide routing, an authenticated API client, login, and protected routes, then builds the faculty-facing project list, create/edit form, detail view, and grant-receipt recording screens against the backend API from `notes/plans/2026-08-07-phase2-projects-grants-backend.md`.

**Architecture:** React 19 + Vite, React Router for navigation, MUI as the primary component library (Tailwind CSS available for utility/custom styling on top, preflight disabled to avoid conflicting with MUI's baseline), a thin `fetch`-based API client wrapping JWT bearer auth, React Context for the authenticated-user/token state. No global state library (Redux/Zustand) — this slice's data needs are simple enough for local component state + the API client's own request/response shapes.

**Tech Stack:** React 19, Vite, React Router 6, MUI 5 (`@mui/material`, `@emotion/react`, `@emotion/styled`), Tailwind CSS (utilities only, `preflight: false`), no additional state-management library.

## Global Constraints

- All API calls go through the shared `apiClient` (Task 2) — no raw `fetch` calls scattered through components.
- JWT is stored in memory (React Context) + `localStorage` for persistence across page reloads — never in a cookie (no CSRF concerns to manage for this slice, backend has no cookie-based auth).
- Every authenticated page is wrapped by the `ProtectedRoute` component (Task 4) — no page manually checks `localStorage` for a token.
- Money values are displayed formatted as `₹` with thousands separators (`Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`), matching the legacy app's `number_format` + "₹" prefix convention.
- Dates are `<input type="date">` bound to `YYYY-MM-DD` strings, matching what the backend's `DateOnly` JSON serialization produces/accepts.
- The 5 `ProjectType` and 7 `BudgetHeadName` enum values are hardcoded as constants in one shared file (Task 5), not duplicated per-component — the backend serializes these as PascalCase strings (e.g. `"TypeIResearch"`, `"RecurringOverhead"`) via default System.Text.Json enum-as-string behavior; confirm this against a live API response in Task 2 before hardcoding the exact casing.
- Every component file has one clear responsibility; forms with multiple dynamic sections (collaborators, budget heads, equipment, manpower) are split into one sub-component per section, not one 500-line form component.

---

## File Structure

```
UI/
  package.json                              (modify: add dependencies)
  tailwind.config.js                        (new)
  postcss.config.js                         (new)
  src/
    index.css                               (modify: add Tailwind directives)
    main.jsx                                (modify: wrap App in BrowserRouter + AuthProvider)
    App.jsx                                 (modify: replace with route definitions)
    api/
      apiClient.js                          (new)
      authApi.js                            (new)
      projectsApi.js                        (new)
    auth/
      AuthContext.jsx                       (new)
      useAuth.js                            (new)
      ProtectedRoute.jsx                    (new)
      LoginPage.jsx                         (new)
    constants/
      projectEnums.js                       (new)
    layout/
      AppLayout.jsx                         (new)
    projects/
      ProjectListPage.jsx                   (new)
      ProjectFormPage.jsx                   (new)
      ProjectDetailPage.jsx                 (new)
      GrantReceiptFormPage.jsx              (new)
      components/
        CollaboratorsFieldArray.jsx         (new)
        BudgetHeadsFieldArray.jsx           (new)
        SanctionedEquipmentFieldArray.jsx   (new)
        SanctionedManpowerFieldArray.jsx    (new)
        BudgetSummaryTable.jsx              (new)
        OverheadSplitInputs.jsx             (new)
      utils/
        currency.js                         (new)
```

---

## Task 1: Install dependencies, configure Tailwind + MUI

**Files:**
- Modify: `UI/package.json`
- Create: `UI/tailwind.config.js`
- Create: `UI/postcss.config.js`
- Modify: `UI/src/index.css`

**Interfaces:**
- Consumes: nothing.
- Produces: MUI's `ThemeProvider`/components available for import in every later task; Tailwind utility classes available in JSX `className` props without colliding with MUI's own styles.

- [ ] **Step 1: Install dependencies**

Run:
```bash
cd D:/Projects/MNNITRNC/UI
npm install @mui/material @emotion/react @emotion/styled @mui/icons-material react-router-dom
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 2: Configure Tailwind with preflight disabled**

`UI/tailwind.config.js` (overwrite the file `npx tailwindcss init -p` generated):
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
}
```

`preflight: false` is required — Tailwind's default preflight reset (removing default margins, changing box-sizing globally, etc.) conflicts with MUI's own CSS baseline (`CssBaseline`), causing inconsistent spacing/typography across MUI components. Disabling it means Tailwind only contributes utility classes, not a competing reset.

- [ ] **Step 3: Add Tailwind directives to the global stylesheet**

Modify `UI/src/index.css` — add at the very top, before any existing content:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Verify the dev server starts cleanly**

Run: `cd D:/Projects/MNNITRNC/UI && npm run dev -- --port 5173 &` then after a few seconds `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173`, then stop the dev server (find and kill only that process, e.g. via the PID `npm run dev` reports or by matching the port in `netstat`).
Expected: `200`.

- [ ] **Step 5: Commit**

```bash
cd D:/Projects/MNNITRNC
git add UI/package.json UI/package-lock.json UI/tailwind.config.js UI/postcss.config.js UI/src/index.css
git commit -m "Add MUI, Tailwind (preflight disabled), and React Router dependencies"
```

---

## Task 2: API client with JWT auth

**Files:**
- Create: `UI/src/api/apiClient.js`
- Create: `UI/src/api/authApi.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (consumed by every later task that talks to the backend):
  ```javascript
  // apiClient.js
  export function setAuthToken(token) // stores token used by subsequent requests
  export function clearAuthToken()
  export async function apiGet(path)              // -> parsed JSON, throws ApiError on non-2xx
  export async function apiPost(path, body)
  export async function apiPut(path, body)
  export async function apiDelete(path)
  export class ApiError extends Error {
    constructor(status, problemDetails) // problemDetails: { title, detail, status } per backend's ProblemDetails shape
  }

  // authApi.js
  export async function login(userName, password) // -> { token, fullName, roles }
  ```

- [ ] **Step 1: Determine the backend base URL and confirm enum JSON casing**

The backend runs on `http://localhost:5899` or similar during local dev (matches whatever port Phase 1/2 backend tasks used). Start the backend (`ASPNETCORE_ENVIRONMENT=Development dotnet run` from `API/API`, per Phase 1/2 backend plans) if not already running, log in as `faculty1`/`Faculty@12345`, and `curl` `GET /api/projects` (after creating a test project via the backend plan's Task 7 Step 6) to inspect the actual JSON casing of `projectType`/`headName` enum values in the response (e.g., confirm whether it's `"TypeIResearch"` or `"typeIResearch"` or `0`). Record the actual casing observed — Task 5 of this plan hardcodes the enum constant list and must match this exactly.

- [ ] **Step 2: Write `apiClient.js`**

`UI/src/api/apiClient.js`:
```javascript
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5899';

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
}

export function clearAuthToken() {
  authToken = null;
}

export class ApiError extends Error {
  constructor(status, problemDetails) {
    super(problemDetails?.detail ?? `Request failed with status ${status}`);
    this.status = status;
    this.problemDetails = problemDetails;
  }
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let problemDetails = null;
    try {
      problemDetails = await response.json();
    } catch {
      // response body wasn't JSON (e.g. empty 401) — problemDetails stays null
    }
    throw new ApiError(response.status, problemDetails);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const apiGet = (path) => request('GET', path);
export const apiPost = (path, body) => request('POST', path, body);
export const apiPut = (path, body) => request('PUT', path, body);
export const apiDelete = (path) => request('DELETE', path);
```

- [ ] **Step 3: Write `authApi.js`**

`UI/src/api/authApi.js`:
```javascript
import { apiPost } from './apiClient';

export async function login(userName, password) {
  return apiPost('/api/auth/login', { userName, password });
}
```

- [ ] **Step 4: Commit**

```bash
cd D:/Projects/MNNITRNC
git add UI/src/api/apiClient.js UI/src/api/authApi.js
git commit -m "Add API client with JWT bearer auth and login API wrapper"
```

---

## Task 3: Auth context, login page, protected routes

**Files:**
- Create: `UI/src/auth/AuthContext.jsx`
- Create: `UI/src/auth/useAuth.js`
- Create: `UI/src/auth/ProtectedRoute.jsx`
- Create: `UI/src/auth/LoginPage.jsx`
- Modify: `UI/src/main.jsx`
- Modify: `UI/src/App.jsx`

**Interfaces:**
- Consumes: `login` (Task 2), `setAuthToken`/`clearAuthToken` (Task 2).
- Produces (consumed by every page component in Tasks 6-9):
  ```javascript
  // useAuth.js
  export function useAuth() // -> { user: { fullName, roles } | null, token: string | null, login: (userName, password) => Promise<void>, logout: () => void, isLoading: boolean }

  // ProtectedRoute.jsx
  export default function ProtectedRoute({ children }) // redirects to /login if not authenticated
  ```

- [ ] **Step 1: Write `AuthContext.jsx`**

`UI/src/auth/AuthContext.jsx`:
```javascript
import { createContext, useState, useEffect, useCallback } from 'react';
import { login as loginApi } from '../api/authApi';
import { setAuthToken, clearAuthToken } from '../api/apiClient';

export const AuthContext = createContext(null);

const STORAGE_KEY = 'mnnitrnc_auth';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      setToken(parsed.token);
      setUser({ fullName: parsed.fullName, roles: parsed.roles });
      setAuthToken(parsed.token);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (userName, password) => {
    const result = await loginApi(userName, password);
    setToken(result.token);
    setUser({ fullName: result.fullName, roles: result.roles });
    setAuthToken(result.token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    clearAuthToken();
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 2: Write `useAuth.js`**

`UI/src/auth/useAuth.js`:
```javascript
import { useContext } from 'react';
import { AuthContext } from './AuthContext';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

- [ ] **Step 3: Write `ProtectedRoute.jsx`**

`UI/src/auth/ProtectedRoute.jsx`:
```javascript
import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';

export default function ProtectedRoute({ children }) {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
```

- [ ] **Step 4: Write `LoginPage.jsx`**

`UI/src/auth/LoginPage.jsx`:
```javascript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography, Alert, Paper } from '@mui/material';
import { useAuth } from './useAuth';
import { ApiError } from '../api/apiClient';

export default function LoginPage() {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(userName, password);
      navigate('/projects');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Invalid username or password.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box className="flex items-center justify-center min-h-screen bg-gray-50">
      <Paper elevation={2} sx={{ padding: 4, width: 360 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          MNIT R&C Portal
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Username"
            fullWidth
            margin="normal"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            required
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          <Button type="submit" variant="contained" fullWidth sx={{ mt: 3 }} disabled={isSubmitting}>
            {isSubmitting ? 'Logging in...' : 'Log In'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}
```

- [ ] **Step 5: Wire `AuthProvider` and `BrowserRouter` into `main.jsx`**

`UI/src/main.jsx`:
```javascript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 6: Replace `App.jsx` with a minimal route stub (full routes added in Task 4)**

`UI/src/App.jsx`:
```javascript
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './auth/LoginPage';
import ProtectedRoute from './auth/ProtectedRoute';

function PlaceholderHome() {
  return <div>Logged in. Project routes are added in the next task.</div>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <PlaceholderHome />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 7: Manual verification against the live backend**

Ensure the backend is running (`ASPNETCORE_ENVIRONMENT=Development dotnet run` from `API/API`, per earlier plans). Start the frontend dev server:
```bash
cd D:/Projects/MNNITRNC/UI
npm run dev -- --port 5173 &
```
Open a browser (or use a headless check) to `http://localhost:5173` — expect a redirect to `/login`. Log in with `faculty1`/`Faculty@12345` — expect a redirect to `/projects` showing the placeholder text. Refresh the page — expect to remain logged in (token persisted via `localStorage`). Stop the dev server afterward.

- [ ] **Step 8: Commit**

```bash
cd D:/Projects/MNNITRNC
git add UI/src/auth UI/src/main.jsx UI/src/App.jsx
git commit -m "Add auth context, login page, and protected routes"
```

---

## Task 4: App layout and full route definitions

**Files:**
- Create: `UI/src/layout/AppLayout.jsx`
- Modify: `UI/src/App.jsx`

**Interfaces:**
- Consumes: `useAuth` (Task 3), `ProtectedRoute` (Task 3).
- Produces: the route tree every page component in Tasks 6-9 plugs into (`/projects`, `/projects/new`, `/projects/:id`, `/projects/:id/edit`, `/projects/:id/grant-receipts/new`), and a shared `AppLayout` (top app bar with the logged-in user's name + logout button, page content below) that every protected page renders inside.

- [ ] **Step 1: Write `AppLayout.jsx`**

`UI/src/layout/AppLayout.jsx`:
```javascript
import { AppBar, Toolbar, Typography, Button, Box, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            MNIT R&C Portal
          </Typography>
          {user && (
            <>
              <Typography sx={{ mr: 2 }}>{user.fullName}</Typography>
              <Button color="inherit" onClick={handleLogout}>Log Out</Button>
            </>
          )}
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {children}
      </Container>
    </Box>
  );
}
```

- [ ] **Step 2: Replace `App.jsx`'s placeholder route with the full route tree**

This task only wires up the routes with placeholder elements for pages not yet built (Tasks 6-9 will replace each placeholder with the real component as they're implemented — this keeps `App.jsx`'s route list stable across the rest of this plan rather than churning it per-task).

`UI/src/App.jsx`:
```javascript
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './auth/LoginPage';
import ProtectedRoute from './auth/ProtectedRoute';
import AppLayout from './layout/AppLayout';
import ProjectListPage from './projects/ProjectListPage';
import ProjectFormPage from './projects/ProjectFormPage';
import ProjectDetailPage from './projects/ProjectDetailPage';
import GrantReceiptFormPage from './projects/GrantReceiptFormPage';

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/projects" element={<Protected><ProjectListPage /></Protected>} />
      <Route path="/projects/new" element={<Protected><ProjectFormPage mode="create" /></Protected>} />
      <Route path="/projects/:id" element={<Protected><ProjectDetailPage /></Protected>} />
      <Route path="/projects/:id/edit" element={<Protected><ProjectFormPage mode="edit" /></Protected>} />
      <Route path="/projects/:id/grant-receipts/new" element={<Protected><GrantReceiptFormPage /></Protected>} />
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}
```

Note: this task references `ProjectListPage`, `ProjectFormPage`, `ProjectDetailPage`, `GrantReceiptFormPage` which don't exist until Tasks 6-9. To keep this task's own build passing, create minimal placeholder files now (Tasks 6-9 will overwrite them with real implementations):

`UI/src/projects/ProjectListPage.jsx`:
```javascript
export default function ProjectListPage() {
  return <div>Project list — implemented in a later task.</div>;
}
```

`UI/src/projects/ProjectFormPage.jsx`:
```javascript
export default function ProjectFormPage({ mode }) {
  return <div>Project form ({mode}) — implemented in a later task.</div>;
}
```

`UI/src/projects/ProjectDetailPage.jsx`:
```javascript
export default function ProjectDetailPage() {
  return <div>Project detail — implemented in a later task.</div>;
}
```

`UI/src/projects/GrantReceiptFormPage.jsx`:
```javascript
export default function GrantReceiptFormPage() {
  return <div>Grant receipt form — implemented in a later task.</div>;
}
```

- [ ] **Step 3: Build to confirm no import errors**

Run: `cd D:/Projects/MNNITRNC/UI && npm run build`
Expected: build succeeds with no module-resolution errors.

- [ ] **Step 4: Commit**

```bash
cd D:/Projects/MNNITRNC
git add UI/src/layout UI/src/App.jsx UI/src/projects/ProjectListPage.jsx UI/src/projects/ProjectFormPage.jsx UI/src/projects/ProjectDetailPage.jsx UI/src/projects/GrantReceiptFormPage.jsx
git commit -m "Add app layout and full route tree with placeholder project pages"
```

---

## Task 5: Projects API wrapper, shared enum constants, currency formatting util

**Files:**
- Create: `UI/src/api/projectsApi.js`
- Create: `UI/src/constants/projectEnums.js`
- Create: `UI/src/projects/utils/currency.js`

**Interfaces:**
- Consumes: `apiGet`/`apiPost`/`apiPut`/`apiDelete` (Task 2).
- Produces (consumed by Tasks 6-9):
  ```javascript
  // projectsApi.js
  export async function listProjects()
  export async function getProject(id)
  export async function createProject(payload)
  export async function updateProject(id, payload)
  export async function deleteProject(id)
  export async function getBudgetSummary(id)
  export async function listGrantReceipts(id)
  export async function recordGrantReceipt(id, payload)

  // projectEnums.js
  export const PROJECT_TYPES  // array of { value, label }
  export const BUDGET_HEAD_NAMES  // array of { value, label }
  export const OVERHEAD_SUB_HEADS  // array of { value, label }

  // currency.js
  export function formatCurrency(amount)  // -> "₹1,00,000.00" style string
  ```

- [ ] **Step 1: Write `projectsApi.js`**

`UI/src/api/projectsApi.js`:
```javascript
import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

export const listProjects = () => apiGet('/api/projects');
export const getProject = (id) => apiGet(`/api/projects/${id}`);
export const createProject = (payload) => apiPost('/api/projects', payload);
export const updateProject = (id, payload) => apiPut(`/api/projects/${id}`, payload);
export const deleteProject = (id) => apiDelete(`/api/projects/${id}`);
export const getBudgetSummary = (id) => apiGet(`/api/projects/${id}/budget-summary`);
export const listGrantReceipts = (id) => apiGet(`/api/projects/${id}/grant-receipts`);
export const recordGrantReceipt = (id, payload) => apiPost(`/api/projects/${id}/grant-receipts`, payload);
```

- [ ] **Step 2: Write `projectEnums.js`**

Use the exact casing confirmed in Task 2 Step 1 against the live backend. If that casing was confirmed as PascalCase (the default for `System.Text.Json` enum-as-string with no custom converter — most likely outcome given the backend plan doesn't configure a `JsonStringEnumConverter` with camelCase naming), use:

`UI/src/constants/projectEnums.js`:
```javascript
export const PROJECT_TYPES = [
  { value: 'TypeIResearch', label: 'Type-I: Research Projects' },
  { value: 'TypeIIIndustrySponsored', label: 'Type-II: Industry Sponsored Projects' },
  { value: 'TypeIIIConsultancy', label: 'Type-III: Consultancy Project' },
  { value: 'TypeIVTesting', label: 'Type IV: Testing' },
  { value: 'TypeVOther', label: 'Type V: Other Activities' },
];

export const BUDGET_HEAD_NAMES = [
  { value: 'EquipmentNonRecurring', label: 'Equipment/Non-recurring' },
  { value: 'RecurringConsumable', label: 'Recurring: Consumable' },
  { value: 'RecurringContingency', label: 'Recurring: Contingency' },
  { value: 'RecurringTravel', label: 'Recurring: Travel' },
  { value: 'RecurringOverhead', label: 'Recurring: Overhead' },
  { value: 'RecurringFieldCharges', label: 'Recurring: Field Charges' },
  { value: 'RecurringManpower', label: 'Recurring: Manpower' },
];

export const OVERHEAD_SUB_HEADS = [
  { value: 'Idf', label: 'IDF (40%)' },
  { value: 'Pdf', label: 'PDF (40%)' },
  { value: 'Ddf', label: 'DDF (20%)' },
];

export const OVERHEAD_HEAD_VALUE = 'RecurringOverhead';
```

If Task 2 Step 1 found a different casing (e.g. camelCase or numeric), adjust every `value` field above to match exactly — this is the single source of truth every other file in this plan imports from, so getting it right here means no other file needs adjustment.

- [ ] **Step 3: Write `currency.js`**

`UI/src/projects/utils/currency.js`:
```javascript
const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(amount) {
  return formatter.format(amount ?? 0);
}
```

- [ ] **Step 4: Build to confirm compilation**

Run: `cd D:/Projects/MNNITRNC/UI && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
cd D:/Projects/MNNITRNC
git add UI/src/api/projectsApi.js UI/src/constants/projectEnums.js UI/src/projects/utils/currency.js
git commit -m "Add projects API wrapper, shared enum constants, and currency formatting util"
```

---

## Task 6: Project list page

**Files:**
- Modify: `UI/src/projects/ProjectListPage.jsx` (replace placeholder)

**Interfaces:**
- Consumes: `listProjects`, `deleteProject` (Task 5), `PROJECT_TYPES` (Task 5), `formatCurrency` (Task 5).
- Produces: the `/projects` page — a table of the faculty user's own projects with View/Edit/Delete actions, matching `faculty_dashboard.php`'s project list (S.No, type, title, agency, total sanctioned, start date, duration) but with real, working type filtering (the legacy Type I-V tabs were confirmed non-functional dead code — this replaces them with actual client-side filtering) and an "Add New Project" button.

- [ ] **Step 1: Write `ProjectListPage.jsx`**

`UI/src/projects/ProjectListPage.jsx`:
```javascript
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, TableHead, TableBody, TableRow, TableCell, Button, Box, Typography,
  IconButton, Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle,
  DialogActions, DialogContent, DialogContentText, Alert,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { listProjects, deleteProject } from '../api/projectsApi';
import { PROJECT_TYPES } from '../constants/projectEnums';
import { formatCurrency } from './utils/currency';

export default function ProjectListPage() {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const navigate = useNavigate();

  const loadProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listProjects();
      setProjects(data);
    } catch {
      setError('Failed to load projects.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const filteredProjects = useMemo(() => {
    if (typeFilter === 'ALL') return projects;
    return projects.filter((p) => p.projectType === typeFilter);
  }, [projects, typeFilter]);

  const handleDeleteConfirmed = async () => {
    if (!pendingDeleteId) return;
    try {
      await deleteProject(pendingDeleteId);
      setPendingDeleteId(null);
      await loadProjects();
    } catch {
      setError('Failed to delete project.');
      setPendingDeleteId(null);
    }
  };

  const typeLabel = (value) => PROJECT_TYPES.find((t) => t.value === value)?.label ?? value;

  return (
    <Box>
      <Box className="flex justify-between items-center mb-4">
        <Typography variant="h5" component="h1">My Projects</Typography>
        <Button variant="contained" onClick={() => navigate('/projects/new')}>Add New Project</Button>
      </Box>

      <FormControl size="small" sx={{ mb: 2, minWidth: 240 }}>
        <InputLabel id="type-filter-label">Filter by Type</InputLabel>
        <Select
          labelId="type-filter-label"
          value={typeFilter}
          label="Filter by Type"
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <MenuItem value="ALL">All Types</MenuItem>
          {PROJECT_TYPES.map((t) => (
            <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {isLoading ? (
        <Typography>Loading...</Typography>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>S.No</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Agency</TableCell>
              <TableCell align="right">Total Sanctioned</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredProjects.map((project, index) => (
              <TableRow key={project.id}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{typeLabel(project.projectType)}</TableCell>
                <TableCell>{project.projectTitle}</TableCell>
                <TableCell>{project.agency}</TableCell>
                <TableCell align="right">{formatCurrency(project.totalSanctioned)}</TableCell>
                <TableCell>{project.startDate}</TableCell>
                <TableCell>{project.durationMonths} months</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => navigate(`/projects/${project.id}`)} aria-label="view">
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => navigate(`/projects/${project.id}/edit`)} aria-label="edit">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => setPendingDeleteId(project.id)} aria-label="delete">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {filteredProjects.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">No projects found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={pendingDeleteId !== null} onClose={() => setPendingDeleteId(null)}>
        <DialogTitle>Delete Project</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this project? This can be undone by an administrator, but the project will no longer appear in your list.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDeleteId(null)}>Cancel</Button>
          <Button onClick={handleDeleteConfirmed} color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
```

- [ ] **Step 2: Manual verification against the live backend**

With both backend and frontend dev servers running (per Task 3 Step 7's pattern), log in as `faculty1`, navigate to `/projects`, confirm the previously-created test project (from the backend plan's Task 7 Step 6) appears in the table with correct formatting. Test the type filter dropdown. Test the delete confirmation dialog (create a throwaway project first via the "Add New Project" button once Task 7 is done, or via direct API call, to avoid deleting the shared test project prematurely).

- [ ] **Step 3: Commit**

```bash
cd D:/Projects/MNNITRNC
git add UI/src/projects/ProjectListPage.jsx
git commit -m "Implement project list page with type filtering and soft-delete confirmation"
```

---

## Task 7: Project create/edit form (with dynamic field arrays)

**Files:**
- Create: `UI/src/projects/components/CollaboratorsFieldArray.jsx`
- Create: `UI/src/projects/components/BudgetHeadsFieldArray.jsx`
- Create: `UI/src/projects/components/SanctionedEquipmentFieldArray.jsx`
- Create: `UI/src/projects/components/SanctionedManpowerFieldArray.jsx`
- Modify: `UI/src/projects/ProjectFormPage.jsx` (replace placeholder)

**Interfaces:**
- Consumes: `createProject`, `updateProject`, `getProject` (Task 5), `PROJECT_TYPES`, `BUDGET_HEAD_NAMES` (Task 5).
- Produces: the `/projects/new` and `/projects/:id/edit` pages. Each field-array component receives `{ items, onChange }` where `items` is an array of plain objects matching the backend DTO shape (`{ id, ...fields }`, `id: null` for new rows) and `onChange(newItems)` replaces the whole array — parent form owns all state, matching React's controlled-component convention and keeping the field-array components simple/stateless.

- [ ] **Step 1: Write `CollaboratorsFieldArray.jsx`**

`UI/src/projects/components/CollaboratorsFieldArray.jsx`:
```javascript
import { Box, TextField, IconButton, Button, Stack } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

export default function CollaboratorsFieldArray({ items, onChange }) {
  const updateItem = (index, field, value) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const addItem = () => {
    onChange([...items, { id: null, institute: '', faculty: '' }]);
  };

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <Box>
      {items.map((item, index) => (
        <Stack key={index} direction="row" spacing={2} sx={{ mb: 1 }} alignItems="center">
          <TextField
            label="Institute"
            value={item.institute}
            onChange={(e) => updateItem(index, 'institute', e.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="Faculty Name"
            value={item.faculty}
            onChange={(e) => updateItem(index, 'faculty', e.target.value)}
            size="small"
            fullWidth
          />
          <IconButton onClick={() => removeItem(index)} aria-label="remove collaborator">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Button startIcon={<AddIcon />} onClick={addItem} size="small">Add Collaborator</Button>
    </Box>
  );
}
```

- [ ] **Step 2: Write `BudgetHeadsFieldArray.jsx`**

`UI/src/projects/components/BudgetHeadsFieldArray.jsx`:
```javascript
import { Box, TextField, Select, MenuItem, FormControl, InputLabel, IconButton, Button, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { BUDGET_HEAD_NAMES } from '../../constants/projectEnums';
import { formatCurrency } from '../utils/currency';

export default function BudgetHeadsFieldArray({ items, onChange }) {
  const updateItem = (index, field, value) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const addItem = () => {
    onChange([...items, { id: null, headName: BUDGET_HEAD_NAMES[0].value, year1Amount: 0, year2Amount: 0, year3Amount: 0 }]);
  };

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const rowTotal = (item) => Number(item.year1Amount || 0) + Number(item.year2Amount || 0) + Number(item.year3Amount || 0);

  return (
    <Box>
      {items.map((item, index) => (
        <Stack key={index} direction="row" spacing={2} sx={{ mb: 1 }} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Budget Head</InputLabel>
            <Select
              label="Budget Head"
              value={item.headName}
              onChange={(e) => updateItem(index, 'headName', e.target.value)}
            >
              {BUDGET_HEAD_NAMES.map((h) => (
                <MenuItem key={h.value} value={h.value}>{h.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Year 1"
            type="number"
            value={item.year1Amount}
            onChange={(e) => updateItem(index, 'year1Amount', e.target.value)}
            size="small"
          />
          <TextField
            label="Year 2"
            type="number"
            value={item.year2Amount}
            onChange={(e) => updateItem(index, 'year2Amount', e.target.value)}
            size="small"
          />
          <TextField
            label="Year 3"
            type="number"
            value={item.year3Amount}
            onChange={(e) => updateItem(index, 'year3Amount', e.target.value)}
            size="small"
          />
          <Typography variant="body2" sx={{ minWidth: 120 }}>{formatCurrency(rowTotal(item))}</Typography>
          <IconButton onClick={() => removeItem(index)} aria-label="remove budget head">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Button startIcon={<AddIcon />} onClick={addItem} size="small">Add Budget Head</Button>
    </Box>
  );
}
```

- [ ] **Step 3: Write `SanctionedEquipmentFieldArray.jsx`**

`UI/src/projects/components/SanctionedEquipmentFieldArray.jsx`:
```javascript
import { Box, TextField, IconButton, Button, Stack } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

export default function SanctionedEquipmentFieldArray({ items, onChange }) {
  const updateItem = (index, field, value) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const addItem = () => {
    onChange([...items, { id: null, name: '', unit: '', amount: 0 }]);
  };

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <Box>
      {items.map((item, index) => (
        <Stack key={index} direction="row" spacing={2} sx={{ mb: 1 }} alignItems="center">
          <TextField label="Equipment Name" value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} size="small" fullWidth />
          <TextField label="Unit" value={item.unit} onChange={(e) => updateItem(index, 'unit', e.target.value)} size="small" />
          <TextField label="Amount" type="number" value={item.amount} onChange={(e) => updateItem(index, 'amount', e.target.value)} size="small" />
          <IconButton onClick={() => removeItem(index)} aria-label="remove equipment">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Button startIcon={<AddIcon />} onClick={addItem} size="small">Add Equipment</Button>
    </Box>
  );
}
```

- [ ] **Step 4: Write `SanctionedManpowerFieldArray.jsx`**

`UI/src/projects/components/SanctionedManpowerFieldArray.jsx`:
```javascript
import { Box, TextField, IconButton, Button, Stack } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

export default function SanctionedManpowerFieldArray({ items, onChange }) {
  const updateItem = (index, field, value) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const addItem = () => {
    onChange([...items, { id: null, designation: '', positions: 1, stipend: 0, hra: 0 }]);
  };

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <Box>
      {items.map((item, index) => (
        <Stack key={index} direction="row" spacing={2} sx={{ mb: 1 }} alignItems="center">
          <TextField label="Designation" value={item.designation} onChange={(e) => updateItem(index, 'designation', e.target.value)} size="small" fullWidth />
          <TextField label="Positions" type="number" value={item.positions} onChange={(e) => updateItem(index, 'positions', e.target.value)} size="small" />
          <TextField label="Stipend" type="number" value={item.stipend} onChange={(e) => updateItem(index, 'stipend', e.target.value)} size="small" />
          <TextField label="HRA" type="number" value={item.hra} onChange={(e) => updateItem(index, 'hra', e.target.value)} size="small" />
          <IconButton onClick={() => removeItem(index)} aria-label="remove manpower position">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Button startIcon={<AddIcon />} onClick={addItem} size="small">Add Manpower Position</Button>
    </Box>
  );
}
```

- [ ] **Step 5: Write `ProjectFormPage.jsx`**

`UI/src/projects/ProjectFormPage.jsx`:
```javascript
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, TextField, Select, MenuItem, FormControl, InputLabel,
  Button, Paper, Stack, Alert, Divider,
} from '@mui/material';
import { createProject, updateProject, getProject } from '../api/projectsApi';
import { PROJECT_TYPES } from '../constants/projectEnums';
import { ApiError } from '../api/apiClient';
import CollaboratorsFieldArray from './components/CollaboratorsFieldArray';
import BudgetHeadsFieldArray from './components/BudgetHeadsFieldArray';
import SanctionedEquipmentFieldArray from './components/SanctionedEquipmentFieldArray';
import SanctionedManpowerFieldArray from './components/SanctionedManpowerFieldArray';

const emptyForm = {
  projectType: PROJECT_TYPES[0].value,
  sanctionNo: '',
  sanctionDate: '',
  projectTitle: '',
  startDate: '',
  agency: '',
  durationMonths: 12,
  totalSanctioned: 0,
  collaborators: [],
  budgetHeads: [],
  sanctionedEquipment: [],
  sanctionedManpowerPositions: [],
};

export default function ProjectFormPage({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [isLoading, setIsLoading] = useState(mode === 'edit');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (mode === 'edit' && id) {
      getProject(id)
        .then((project) => setForm(project))
        .catch(() => setError('Failed to load project.'))
        .finally(() => setIsLoading(false));
    }
  }, [mode, id]);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (mode === 'create') {
        const created = await createProject(form);
        navigate(`/projects/${created.id}`);
      } else {
        const updated = await updateProject(id, form);
        navigate(`/projects/${updated.id}`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.problemDetails?.detail ?? 'Failed to save project.');
      } else {
        setError('Failed to save project.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="h5" component="h1" sx={{ mb: 3 }}>
        {mode === 'create' ? 'Add New Project' : 'Edit Project'}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack spacing={2}>
          <FormControl>
            <InputLabel>Project Type</InputLabel>
            <Select label="Project Type" value={form.projectType} onChange={(e) => setField('projectType', e.target.value)}>
              {PROJECT_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Sanction No." value={form.sanctionNo} onChange={(e) => setField('sanctionNo', e.target.value)} required />
          <TextField label="Sanction Date" type="date" value={form.sanctionDate} onChange={(e) => setField('sanctionDate', e.target.value)} InputLabelProps={{ shrink: true }} required />
          <TextField label="Project Title" value={form.projectTitle} onChange={(e) => setField('projectTitle', e.target.value)} required />
          <TextField label="Start Date" type="date" value={form.startDate} onChange={(e) => setField('startDate', e.target.value)} InputLabelProps={{ shrink: true }} required />
          <TextField label="Agency" value={form.agency} onChange={(e) => setField('agency', e.target.value)} required />
          <TextField label="Duration (months)" type="number" value={form.durationMonths} onChange={(e) => setField('durationMonths', Number(e.target.value))} required />
          <TextField label="Total Sanctioned to MNNIT" type="number" value={form.totalSanctioned} onChange={(e) => setField('totalSanctioned', Number(e.target.value))} required />
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Collaborators</Typography>
        <CollaboratorsFieldArray items={form.collaborators} onChange={(items) => setField('collaborators', items)} />
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Budget Heads</Typography>
        <BudgetHeadsFieldArray items={form.budgetHeads} onChange={(items) => setField('budgetHeads', items)} />
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Sanctioned Equipment</Typography>
        <SanctionedEquipmentFieldArray items={form.sanctionedEquipment} onChange={(items) => setField('sanctionedEquipment', items)} />
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Sanctioned Manpower</Typography>
        <SanctionedManpowerFieldArray items={form.sanctionedManpowerPositions} onChange={(items) => setField('sanctionedManpowerPositions', items)} />
      </Paper>

      <Divider sx={{ mb: 3 }} />

      <Stack direction="row" spacing={2}>
        <Button type="submit" variant="contained" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Project'}
        </Button>
        <Button variant="outlined" onClick={() => navigate('/projects')}>Cancel</Button>
      </Stack>
    </Box>
  );
}
```

- [ ] **Step 6: Manual verification against the live backend**

With backend + frontend running, navigate to `/projects/new`, fill in the form (project type, sanction number, dates, title, agency, duration, total sanctioned), add one collaborator and one budget head (e.g. "Recurring: Overhead" with year amounts), submit. Confirm redirect to the new project's detail page (even though `ProjectDetailPage` is still a placeholder at this point in the plan — confirm the URL is correct and no error occurred). Then navigate to `/projects`, confirm the new project appears, click Edit, change a field, save, confirm the change persisted by re-opening edit.

- [ ] **Step 7: Commit**

```bash
cd D:/Projects/MNNITRNC
git add UI/src/projects/components UI/src/projects/ProjectFormPage.jsx
git commit -m "Implement project create/edit form with dynamic collaborator/budget-head/equipment/manpower sections"
```

---

## Task 8: Project detail page with budget summary

**Files:**
- Create: `UI/src/projects/components/BudgetSummaryTable.jsx`
- Modify: `UI/src/projects/ProjectDetailPage.jsx` (replace placeholder)

**Interfaces:**
- Consumes: `getProject`, `getBudgetSummary` (Task 5), `formatCurrency` (Task 5), `PROJECT_TYPES`, `BUDGET_HEAD_NAMES` (Task 5).
- Produces: the `/projects/:id` page — replicates `view_project.php`'s Basic Info, Collaborators, and Budget & Grant Details sections (sanctioned equipment/manpower shown read-only; procurement/recruitment workflow status is out of scope per the spec, so those tables show only the sanctioned catalog entries, no live requisition/activity status columns).

- [ ] **Step 1: Write `BudgetSummaryTable.jsx`**

`UI/src/projects/components/BudgetSummaryTable.jsx`:
```javascript
import { Table, TableHead, TableBody, TableRow, TableCell, Typography } from '@mui/material';
import { BUDGET_HEAD_NAMES } from '../../constants/projectEnums';
import { formatCurrency } from '../utils/currency';

export default function BudgetSummaryTable({ lines }) {
  const headLabel = (value) => BUDGET_HEAD_NAMES.find((h) => h.value === value)?.label ?? value;

  if (lines.length === 0) {
    return <Typography color="text.secondary">No budget heads defined for this project.</Typography>;
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Budget Head</TableCell>
          <TableCell align="center">Project Year</TableCell>
          <TableCell align="right">Sanctioned</TableCell>
          <TableCell align="right">Grant Received</TableCell>
          <TableCell align="right">Spent</TableCell>
          <TableCell align="right">Available</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {lines.map((line, index) => (
          <TableRow key={`${line.headName}-${line.projectYear}-${index}`}>
            <TableCell>{headLabel(line.headName)}</TableCell>
            <TableCell align="center">{line.projectYear}</TableCell>
            <TableCell align="right">{formatCurrency(line.sanctioned)}</TableCell>
            <TableCell align="right">{formatCurrency(line.grantReceived)}</TableCell>
            <TableCell align="right">{formatCurrency(line.spent)}</TableCell>
            <TableCell align="right">{formatCurrency(line.available)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 2: Write `ProjectDetailPage.jsx`**

`UI/src/projects/ProjectDetailPage.jsx`:
```javascript
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Stack, Table, TableHead, TableBody, TableRow, TableCell,
  Button, Alert, Chip,
} from '@mui/material';
import { getProject, getBudgetSummary } from '../api/projectsApi';
import { PROJECT_TYPES } from '../constants/projectEnums';
import { formatCurrency } from './utils/currency';
import BudgetSummaryTable from './components/BudgetSummaryTable';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [budgetLines, setBudgetLines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([getProject(id), getBudgetSummary(id)])
      .then(([projectData, summaryData]) => {
        setProject(projectData);
        setBudgetLines(summaryData.lines);
      })
      .catch(() => setError('Failed to load project.'))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  if (error || !project) {
    return <Alert severity="error">{error ?? 'Project not found.'}</Alert>;
  }

  const typeLabel = PROJECT_TYPES.find((t) => t.value === project.projectType)?.label ?? project.projectType;

  return (
    <Box>
      <Box className="flex justify-between items-center mb-4">
        <Typography variant="h5" component="h1">{project.projectTitle}</Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" onClick={() => navigate(`/projects/${id}/edit`)}>Edit</Button>
          <Button variant="contained" onClick={() => navigate(`/projects/${id}/grant-receipts/new`)}>
            Record Grant Receipt
          </Button>
        </Stack>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Basic Info</Typography>
        <Stack spacing={1}>
          <Typography><Chip label={typeLabel} size="small" sx={{ mr: 1 }} /></Typography>
          <Typography>Sanction No.: {project.sanctionNo}</Typography>
          <Typography>Sanction Date: {project.sanctionDate}</Typography>
          <Typography>Start Date: {project.startDate}</Typography>
          <Typography>Agency: {project.agency}</Typography>
          <Typography>Duration: {project.durationMonths} months</Typography>
          <Typography>Total Sanctioned: {formatCurrency(project.totalSanctioned)}</Typography>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Collaborators</Typography>
        {project.collaborators.length === 0 ? (
          <Typography color="text.secondary">No collaborators.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Institute</TableCell>
                <TableCell>Faculty</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {project.collaborators.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.institute}</TableCell>
                  <TableCell>{c.faculty}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Budget &amp; Grant Details</Typography>
        <BudgetSummaryTable lines={budgetLines} />
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Sanctioned Equipment</Typography>
        {project.sanctionedEquipment.length === 0 ? (
          <Typography color="text.secondary">No sanctioned equipment.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Unit</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {project.sanctionedEquipment.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.name}</TableCell>
                  <TableCell>{e.unit}</TableCell>
                  <TableCell align="right">{formatCurrency(e.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Sanctioned Manpower</Typography>
        {project.sanctionedManpowerPositions.length === 0 ? (
          <Typography color="text.secondary">No sanctioned manpower positions.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Designation</TableCell>
                <TableCell align="right">Positions</TableCell>
                <TableCell align="right">Stipend</TableCell>
                <TableCell align="right">HRA</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {project.sanctionedManpowerPositions.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.designation}</TableCell>
                  <TableCell align="right">{m.positions}</TableCell>
                  <TableCell align="right">{formatCurrency(m.stipend)}</TableCell>
                  <TableCell align="right">{formatCurrency(m.hra)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}
```

- [ ] **Step 3: Manual verification against the live backend**

Navigate to the detail page of the project created in Task 7's verification. Confirm Basic Info, Collaborators, Budget & Grant Details (should show 3 rows — years 1/2/3 — for the Overhead head, with `Sanctioned` matching what was entered and `Grant Received`/`Spent`/`Available` all zero since no receipt has been recorded yet), and Sanctioned Equipment/Manpower sections all render correctly.

- [ ] **Step 4: Commit**

```bash
cd D:/Projects/MNNITRNC
git add UI/src/projects/components/BudgetSummaryTable.jsx UI/src/projects/ProjectDetailPage.jsx
git commit -m "Implement project detail page with basic info, collaborators, and budget summary"
```

---

## Task 9: Grant receipt recording form with overhead split

**Files:**
- Create: `UI/src/projects/components/OverheadSplitInputs.jsx`
- Modify: `UI/src/projects/GrantReceiptFormPage.jsx` (replace placeholder)

**Interfaces:**
- Consumes: `getProject`, `recordGrantReceipt` (Task 5), `BUDGET_HEAD_NAMES`, `OVERHEAD_SUB_HEADS`, `OVERHEAD_HEAD_VALUE` (Task 5).
- Produces: the `/projects/:id/grant-receipts/new` page — replicates `add_grant_received.php`'s per-head amount entry with live-computed (client-side preview, server-validated on submit) IDF/PDF/DDF split shown only when the Overhead head is selected.

- [ ] **Step 1: Write `OverheadSplitInputs.jsx`**

`UI/src/projects/components/OverheadSplitInputs.jsx`:
```javascript
import { useEffect } from 'react';
import { Box, TextField, Stack, Typography } from '@mui/material';
import { OVERHEAD_SUB_HEADS } from '../../constants/projectEnums';

const RATIOS = { Idf: 0.4, Pdf: 0.4, Ddf: 0.2 };

export default function OverheadSplitInputs({ overheadAmount, split, onChange }) {
  useEffect(() => {
    const computed = {};
    for (const subHead of OVERHEAD_SUB_HEADS) {
      computed[subHead.value] = Math.round(Number(overheadAmount || 0) * RATIOS[subHead.value] * 100) / 100;
    }
    onChange(computed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overheadAmount]);

  return (
    <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Overhead Split (IDF 40% / PDF 40% / DDF 20%)
      </Typography>
      <Stack direction="row" spacing={2}>
        {OVERHEAD_SUB_HEADS.map((subHead) => (
          <TextField
            key={subHead.value}
            label={subHead.label}
            type="number"
            value={split[subHead.value] ?? 0}
            size="small"
            InputProps={{ readOnly: true }}
          />
        ))}
      </Stack>
    </Box>
  );
}
```

Note: matching the spec's decision ("user enters IDF/PDF/DDF amounts... but the API validates"), this component displays the computed split as read-only fields rather than editable ones. The legacy app allowed editing; this deliberately simplifies to computed-and-shown since the server rejects any mismatch anyway — an editable field that the server will reject on mismatch is worse UX than a correct, non-editable preview. If a later requirement needs manual override with server-side re-validation surfaced inline, revisit this component; not needed for this slice per the locked decision (the amounts must match the ratio, so there is nothing valid to type differently).

- [ ] **Step 2: Write `GrantReceiptFormPage.jsx`**

`UI/src/projects/GrantReceiptFormPage.jsx`:
```javascript
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, TextField, Select, MenuItem, FormControl, InputLabel,
  Button, Paper, Stack, Alert,
} from '@mui/material';
import { getProject, recordGrantReceipt } from '../api/projectsApi';
import { BUDGET_HEAD_NAMES, OVERHEAD_HEAD_VALUE } from '../constants/projectEnums';
import { ApiError } from '../api/apiClient';
import OverheadSplitInputs from './components/OverheadSplitInputs';

export default function GrantReceiptFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [budgetHeadId, setBudgetHeadId] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [amount, setAmount] = useState(0);
  const [overheadSplit, setOverheadSplit] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getProject(id)
      .then((data) => {
        setProject(data);
        if (data.budgetHeads.length > 0) {
          setBudgetHeadId(data.budgetHeads[0].id);
        }
      })
      .catch(() => setError('Failed to load project.'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const selectedHead = project?.budgetHeads.find((h) => h.id === budgetHeadId);
  const isOverheadHead = selectedHead?.headName === OVERHEAD_HEAD_VALUE;

  const headLabel = (value) => BUDGET_HEAD_NAMES.find((h) => h.value === value)?.label ?? value;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await recordGrantReceipt(id, {
        budgetHeadId,
        receivedDate,
        amount: Number(amount),
        overheadSplit: isOverheadHead ? overheadSplit : null,
      });
      navigate(`/projects/${id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.problemDetails?.detail ?? 'Failed to record grant receipt.');
      } else {
        setError('Failed to record grant receipt.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  if (!project) {
    return <Alert severity="error">{error ?? 'Project not found.'}</Alert>;
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="h5" component="h1" sx={{ mb: 3 }}>
        Record Grant Receipt — {project.projectTitle}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <FormControl>
            <InputLabel>Budget Head</InputLabel>
            <Select label="Budget Head" value={budgetHeadId} onChange={(e) => setBudgetHeadId(e.target.value)}>
              {project.budgetHeads.map((h) => (
                <MenuItem key={h.id} value={h.id}>{headLabel(h.headName)}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Received Date"
            type="date"
            value={receivedDate}
            onChange={(e) => setReceivedDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            required
          />
          <TextField
            label="Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          {isOverheadHead && (
            <OverheadSplitInputs overheadAmount={amount} split={overheadSplit} onChange={setOverheadSplit} />
          )}
        </Stack>

        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button type="submit" variant="contained" disabled={isSubmitting || !budgetHeadId}>
            {isSubmitting ? 'Saving...' : 'Record Receipt'}
          </Button>
          <Button variant="outlined" onClick={() => navigate(`/projects/${id}`)}>Cancel</Button>
        </Stack>
      </Paper>
    </Box>
  );
}
```

- [ ] **Step 3: Manual verification against the live backend**

Navigate to the Overhead head's grant-receipt form for the test project (via the "Record Grant Receipt" button on the detail page). Confirm selecting the Overhead budget head shows the computed IDF/PDF/DDF split fields, updating live as the Amount field changes. Enter an amount (e.g. 10000), confirm the split shows 4000/4000/2000. Submit, confirm redirect to the detail page, and confirm the Budget & Grant Details table now shows `Grant Received` and `Available` reflecting the new receipt for the correct project-year (matching the received date entered). Also verify selecting a non-Overhead head hides the split inputs and a plain amount submits successfully.

- [ ] **Step 4: Commit**

```bash
cd D:/Projects/MNNITRNC
git add UI/src/projects/components/OverheadSplitInputs.jsx UI/src/projects/GrantReceiptFormPage.jsx
git commit -m "Implement grant receipt recording form with computed overhead split preview"
```

---

## Task 10: Full-solution verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run a full production build**

Run: `cd D:/Projects/MNNITRNC/UI && npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 2: Run the linter**

Run: `cd D:/Projects/MNNITRNC/UI && npm run lint`
Expected: no errors (warnings acceptable if pre-existing from the Vite scaffold; any new warnings introduced by this plan's files should be fixed before checking this box).

- [ ] **Step 3: End-to-end manual walkthrough against the live backend**

With both backend and frontend running: log out and log back in (confirms auth persistence and logout both work), create a new project with all four child-collection types populated (collaborator, budget head, equipment, manpower), view it, edit it (change a budget head amount, add a second collaborator), confirm the edit persisted correctly and the original collaborator/budget-head rows kept their identity (no duplicate rows), record a grant receipt against the Overhead head, confirm the budget summary reflects it, then soft-delete the project and confirm it disappears from the list.

- [ ] **Step 4: Confirm no plan step was skipped**

Check off any unchecked boxes above only after re-running the corresponding command and confirming the expected output.

---

## Self-Review Notes (for the plan author, not a task)

- **Spec coverage check**: faculty dashboard project list with working type filter (fixing legacy's dead tabs) ✅ (Task 6), project create/edit form matching legacy's field structure but with a single structured payload instead of parallel arrays ✅ (Task 7), project detail view with Budget & Grant Details reporting ✅ (Task 8), grant receipt recording with the overhead split ✅ (Task 9). Login/auth foundation, absent from the bare scaffold, is bootstrapped in Tasks 1-4 as agreed. Sanctioned equipment/manpower shown read-only in the detail view (no procurement/recruitment workflow status) matches the spec's explicit out-of-scope boundary.
- **Placeholder scan**: Task 4's placeholder page components are intentional, temporary scaffolding explicitly replaced by Tasks 6-9 (not a "TODO left for someone else" — each placeholder's replacement is a concrete later task in this same plan).
- **Type consistency**: `projectsApi.js` (Task 5) function names/signatures are consumed identically by every page component in Tasks 6-9 (`listProjects()`, `getProject(id)`, `createProject(payload)`, `updateProject(id, payload)`, `deleteProject(id)`, `getBudgetSummary(id)`, `recordGrantReceipt(id, payload)`). Field-array components' `{ items, onChange }` contract (Task 7) is applied uniformly across all four field-array types. `PROJECT_TYPES`/`BUDGET_HEAD_NAMES`/`OVERHEAD_SUB_HEADS`/`OVERHEAD_HEAD_VALUE` (Task 5) are the single source of truth imported by Tasks 6, 7, 8, 9 — no component redefines these lists.
- **Backend contract dependency**: this plan assumes the backend plan (`2026-08-07-phase2-projects-grants-backend.md`) is fully implemented and running before Task 2 Step 1 can confirm enum JSON casing and before any "manual verification against the live backend" step in Tasks 3, 6, 7, 8, 9 can execute. If the backend plan has not yet been executed when this plan starts, execute it first — this frontend plan is not independently testable without it.
