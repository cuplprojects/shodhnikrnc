/**
 * JWT Token Utilities
 * Helper functions for JWT token operations
 */

/**
 * Decode JWT token payload
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded payload or null if invalid
 */
export const decodeJWTPayload = (token) => {
  try {
    if (!token) {
      return null;
    }
    
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    // The payload is the second part (index 1)
    const payload = parts[1];
    
    // Decode base64url
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    
    // Parse JSON
    const parsedPayload = JSON.parse(decoded);
    

    
    return parsedPayload;
  } catch (error) {
    console.error('JWT Utils: Error decoding JWT token:', error);
    return null;
  }
};

/**
 * Check if token is expired
 * @param {string} token - JWT token
 * @returns {boolean} True if token is expired
 */
export const isTokenExpired = (token) => {
  try {
    const payload = decodeJWTPayload(token);
    if (!payload || !payload.exp) return true;
    
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true;
  }
};

/**
 * Get user ID from token
 * @param {string} token - JWT token
 * @returns {string|null} User ID or null
 */
export const getUserIdFromToken = (token) => {
  try {
    const payload = decodeJWTPayload(token);
    if (!payload) {
      return null;
    }
    
    const userId = payload?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || 
                   payload?.name || 
                   payload?.sub || 
                   null;
    

    
    return userId;
  } catch (error) {
    console.error('JWT Utils: Error getting user ID from token:', error);
    return null;
  }
};

/**
 * Check if password is auto-generated from token claims
 * @param {string} token - JWT token
 * @returns {Object} Object with isTempAutoGen and isPermAutoGen flags
 */
export const getPasswordAutoGenFlags = (token) => {
  try {
    const payload = decodeJWTPayload(token);
    if (!payload) {
      return { isTempAutoGen: false, isPermAutoGen: false };
    }
    
    // Check for autogen flags in token claims
    // Handle cases where these claims might not exist (like supervisor tokens)
    const tempAutogenRaw = payload.TempAutogen;
    const permAutogenRaw = payload.PermAutogen;
    
    const isTempAutoGen = tempAutogenRaw === 'True' || tempAutogenRaw === true;
    const isPermAutoGen = permAutogenRaw === 'True' || permAutogenRaw === true;
    

    
    return { isTempAutoGen, isPermAutoGen };
  } catch (error) {
    console.error('JWT Utils: Error getting autogen flags from token:', error);
    return { isTempAutoGen: false, isPermAutoGen: false };
  }
};

/**
 * Get all token claims
 * @param {string} token - JWT token
 * @returns {Object|null} All token claims or null
 */
export const getTokenClaims = (token) => {
  return decodeJWTPayload(token);
};