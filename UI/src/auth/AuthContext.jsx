import { useState, useCallback } from 'react';
import { login as loginApi } from '../api/authApi';
import { setAuthToken, clearAuthToken } from '../api/apiClient';
import { AuthContext } from './authContextObject';

const STORAGE_KEY = 'mnnitrnc_auth';

/**
 * The JWT's `sub` claim carries the user's id (see JwtTokenService on the
 * API side). Nothing in the login response itself exposes a user id, so
 * this is the only place the id is available client-side.
 */
function decodeUserIdFromToken(token) {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.sub ?? null;
  } catch {
    return null;
  }
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
    <AuthContext.Provider value={{ token, user, login, logout, markProfileComplete, isLoading: false }}>
      {children}
    </AuthContext.Provider>
  );
}
