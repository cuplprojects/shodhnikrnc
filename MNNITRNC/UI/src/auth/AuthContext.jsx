import { useState, useCallback } from 'react';
import { login as loginApi, registerFacultyFederated } from '../api/authApi';
import { setAuthToken, clearAuthToken } from '../api/apiClient';
import { AuthContext } from './authContextObject';

const STORAGE_KEY = 'mnnitrnc_auth';

function decodeTokenPayload(token) {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

/**
 * The JWT's `sub` claim carries the user's id (see JwtTokenService on the
 * API side). Nothing in the login response itself exposes a user id, so
 * this is the only place the id is available client-side.
 */
function decodeUserIdFromToken(token) {
  return decodeTokenPayload(token)?.sub ?? null;
}

/**
 * The federated register endpoint returns only { status, token } -- unlike
 * the password login response, it doesn't echo fullName/roles separately,
 * since JwtTokenService already put both on the token itself (full_name
 * claim, and ClaimTypes.Role -- "role" once JSON-decoded). Decoded here
 * rather than asking the backend to duplicate what the token already carries.
 */
function decodeUserFromRncToken(token) {
  const payload = decodeTokenPayload(token) ?? {};
  const roleClaim = payload.role;
  const roles = Array.isArray(roleClaim) ? roleClaim : roleClaim ? [roleClaim] : [];
  return { fullName: payload.full_name ?? '', roles, profileComplete: false };
}

function readStoredAuth() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return { token: null, user: null };
  }
  const parsed = JSON.parse(stored);
  setAuthToken(parsed.token);
  return {
    token: parsed.token,
    user: {
      fullName: parsed.fullName,
      roles: parsed.roles,
      userId: decodeUserIdFromToken(parsed.token),
      profileComplete: parsed.profileComplete,
    },
  };
}

export function AuthProvider({ children }) {
  const [{ token, user }, setAuthState] = useState(readStoredAuth);

  const login = useCallback(async (userName, password) => {
    const result = await loginApi(userName, password);
    setAuthToken(result.token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    setAuthState({
      token: result.token,
      user: {
        fullName: result.fullName,
        roles: result.roles,
        userId: decodeUserIdFromToken(result.token),
        profileComplete: result.profileComplete,
      },
    });
  }, []);

  // Used by the Shodhanik-SSO landing page: shodhanikToken is the Shodhanik-
  // issued JWT the user arrived with, never stored or used again past this
  // call. The response's own token is RNC-native (minted by
  // AuthController.RegisterFacultyFederated) and from here on is this
  // session's one and only token, exactly like a password login's.
  const loginFederated = useCallback(async (shodhanikToken) => {
    const result = await registerFacultyFederated(shodhanikToken);
    const decodedUser = decodeUserFromRncToken(result.token);
    setAuthToken(result.token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: result.token, ...decodedUser }));
    setAuthState({
      token: result.token,
      user: { ...decodedUser, userId: decodeUserIdFromToken(result.token) },
    });
    return result.status;
  }, []);

  // markProfileComplete lets the complete-profile page update auth state
  // in place after a successful save, without requiring the user to log
  // in again to pick up the new value.
  const markProfileComplete = useCallback(() => {
    setAuthState((prev) => {
      if (!prev.user) return prev;
      const updatedUser = { ...prev.user, profileComplete: true };
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, profileComplete: true }));
      return { ...prev, user: updatedUser };
    });
  }, []);

  const logout = useCallback(() => {
    clearAuthToken();
    localStorage.removeItem(STORAGE_KEY);
    setAuthState({ token: null, user: null });
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, loginFederated, logout, markProfileComplete, isLoading: false }}>
      {children}
    </AuthContext.Provider>
  );
}
