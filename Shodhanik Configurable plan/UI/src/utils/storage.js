// src/services/storageService.js
import { encryptData, decryptData } from './encryptionUtils';

const STORAGE_TYPE = import.meta.env.VITE_STORAGE || 'local';

// Encryption configuration - simple and clean
const ENCRYPTION_CONFIG = {
    // Global encryption flag from environment - fallback to true for security
    enabled: import.meta.env.VITE_ENABLE_STORAGE_ENCRYPTION !== 'false'
};

/**
 * Determine if a key needs encryption based on configuration
 * @param {string} key - Storage key to check
 * @returns {boolean} - Whether the key should be encrypted
 */
const needEncryption = (key) => {
    // If global encryption is enabled, encrypt everything
    return ENCRYPTION_CONFIG.enabled;
};

/**
 * Resolve storage based on env variable
 */
const resolveStorage = () => {
    if (STORAGE_TYPE === 'session') return window.sessionStorage;
    if (STORAGE_TYPE === 'local') return window.localStorage;

    console.warn(
        `[StorageService] Invalid VITE_STORAGE value: "${STORAGE_TYPE}". Falling back to localStorage.`
    );
    return window.localStorage;
};

const storage = resolveStorage();

/**
 * Safely stringify value
 */
const serialize = (value) => {
    try {
        return JSON.stringify(value);
    } catch (err) {
        console.error('[StorageService] Serialization failed:', err);
        return null;
    }
};

/**
 * Safely parse value
 */
const deserialize = (value) => {
    try {
        return value === null ? null : JSON.parse(value);
    } catch (err) {
        console.error('[StorageService] Deserialization failed:', err);
        return null;
    }
};

const StorageService = {
    /**
     * Set value in storage (with automatic encryption based on key)
     * @param {string} key - Storage key
     * @param {any} value - Value to store
     */
    set(key, value) {
        if (!key) return;

        try {
            let dataToStore;
            
            // Check if this key needs encryption
            if (needEncryption(key)) {
                // Try to encrypt the data before storing
                dataToStore = encryptData(value);
                if (dataToStore === null) {
                    console.warn('[StorageService] Encryption failed for key:', key, '- falling back to plain JSON');
                    // Fallback to plain JSON if encryption fails
                    dataToStore = serialize(value);
                    if (dataToStore === null) return;
                }
            } else {
                // Store as regular JSON
                dataToStore = serialize(value);
                if (dataToStore === null) return;
            }

            storage.setItem(key, dataToStore);
        } catch (err) {
            console.error('[StorageService] set failed:', err);
        }
    },

    /**
     * Get value from storage (with automatic decryption based on key)
     * @param {string} key - Storage key
     * @returns {any} - Retrieved value
     */
    get(key) {
        if (!key) return null;

        try {
            const value = storage.getItem(key);
            if (value === null) return null;

            // Check if this key needs decryption
            if (needEncryption(key)) {
                // Try to decrypt the data
                const decryptedData = decryptData(value);
                if (decryptedData === null) {
                    console.warn('[StorageService] Decryption failed for key:', key, '- trying plain JSON fallback');
                    // Fallback to plain JSON parsing if decryption fails
                    return deserialize(value);
                }
                return decryptedData;
            } else {
                // Parse as regular JSON
                return deserialize(value);
            }
        } catch (err) {
            console.error('[StorageService] get failed:', err);
            return null;
        }
    },

    /**
     * Set value in storage with optional encryption override
     * @param {string} key - Storage key
     * @param {any} value - Value to store
     * @param {boolean} encrypt - Whether to encrypt the value (overrides automatic detection)
     */
    setSecure(key, value, encrypt = false) {
        if (!key) return;

        try {
            let dataToStore;
            
            if (encrypt) {
                // Encrypt the data before storing
                dataToStore = encryptData(value);
                if (dataToStore === null) {
                    console.error('[StorageService] Encryption failed for key:', key);
                    return;
                }
            } else {
                // Store as regular JSON
                dataToStore = serialize(value);
                if (dataToStore === null) return;
            }

            storage.setItem(key, dataToStore);
        } catch (err) {
            console.error('[StorageService] setSecure failed:', err);
        }
    },

    /**
     * Get value from storage with optional decryption override
     * @param {string} key - Storage key
     * @param {boolean} decrypt - Whether to decrypt the value (overrides automatic detection)
     */
    getSecure(key, decrypt = false) {
        if (!key) return null;

        try {
            const value = storage.getItem(key);
            if (value === null) return null;

            if (decrypt) {
                // Decrypt the data
                return decryptData(value);
            } else {
                // Parse as regular JSON
                return deserialize(value);
            }
        } catch (err) {
            console.error('[StorageService] getSecure failed:', err);
            return null;
        }
    },

    /**
     * Set encrypted value in storage (force encryption)
     * @param {string} key - Storage key
     * @param {any} value - Value to encrypt and store
     */
    setEncrypted(key, value) {
        return this.setSecure(key, value, true);
    },

    /**
     * Get and decrypt value from storage (force decryption)
     * @param {string} key - Storage key
     */
    getDecrypted(key) {
        return this.getSecure(key, true);
    },

    /**
     * Remove single key
     */
    remove(key) {
        if (!key) return;

        try {
            storage.removeItem(key);
        } catch (err) {
            console.error('[StorageService] remove failed:', err);
        }
    },

    /**
     * Clear entire storage
     */
    clear() {
        try {
            storage.clear();
        } catch (err) {
            console.error('[StorageService] clear failed:', err);
        }
    },

    /**
     * Check if a key exists in storage
     */
    has(key) {
        if (!key) return false;
        
        try {
            return storage.getItem(key) !== null;
        } catch (err) {
            console.error('[StorageService] has failed:', err);
            return false;
        }
    },

    /**
     * Get all keys from storage
     */
    keys() {
        try {
            return Object.keys(storage);
        } catch (err) {
            console.error('[StorageService] keys failed:', err);
            return [];
        }
    }
};

export default StorageService;

/*
// Example Usage

import StorageService from '@/utils/storage';

// Simple: ALL data will be encrypted if VITE_ENABLE_STORAGE_ENCRYPTION=true
StorageService.set('authToken', 'secret-token'); // Encrypted if enabled
StorageService.set('userPreferences', { theme: 'dark' }); // Encrypted if enabled
StorageService.set('anyData', 'any-value'); // Encrypted if enabled

const token = StorageService.get('authToken'); // Auto-decrypted if was encrypted
const prefs = StorageService.get('userPreferences'); // Auto-decrypted if was encrypted
const data = StorageService.get('anyData'); // Auto-decrypted if was encrypted

// Manual control (override automatic behavior)
StorageService.setSecure('tempData', data, false); // Force no encryption
StorageService.getSecure('tempData', false); // Force no decryption

StorageService.setSecure('secretData', data, true); // Force encryption
StorageService.getSecure('secretData', true); // Force decryption

// Utility methods
const hasToken = StorageService.has('authToken');
const allKeys = StorageService.keys();

// Remove and clear
StorageService.remove('authToken');
StorageService.clear();

// Configuration:
// Set VITE_ENABLE_STORAGE_ENCRYPTION=true in .env to encrypt ALL data
// Set VITE_ENABLE_STORAGE_ENCRYPTION=false (or omit) to store all data as plain JSON
*/